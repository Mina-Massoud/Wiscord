# Payments Flow Audit — 2026-05-18

**Status:** Pre-launch security & correctness review of Wiscord's $9/mo Pro tier (Stripe Checkout + Billing Portal + Webhooks + quota enforcement).

**Auditors:** 4 parallel sub-agents (webhook security, billing service authz, quota enforcement, Stripe production research) against read-only access.

**Result:** **6 launch-blockers**, 10 highs, 8 mediums. No silent-money-loss bugs in the current code path, but the quota system has two ways for a free user to effectively bypass the cap, and the webhook layer can lose events permanently if certain config is missing.

---

## How to read this report

Each finding has four parts:

| Field | Why |
|-------|-----|
| **What's wrong** | The actual bug, in mechanical terms |
| **Why it matters** | The consequence — in money, data, or legal terms |
| **The fix** | Concrete code or config change |
| **How to verify** | A test or manual repro that proves the fix works |

Severity uses the standard 4-level scheme:

| Level | Meaning | Gate |
|-------|---------|------|
| CRITICAL | Block launch | Must ship before any non-friend pays |
| HIGH | Bug or significant risk | Should ship before first 10 paying customers |
| MEDIUM | Correctness or maintainability | Should ship before first 100 |
| LOW | Notes / nice-to-have | Backlog |

---

## Executive Summary

The good news first: **the implementation got the hard things right.** Raw-body parsing for webhook signature verification is correctly scoped (the #1 mistake everyone makes is wrong), tier is server-resolved (never trusted from the client), every billing endpoint is authenticated, no IDOR, no open redirect, no secret leakage, Stripe API version is pinned, and the self-healing customer recovery flow is genuinely clever defensive code.

The bad news: **the quota system — which is what Pro literally pays for — has two ways for a free user to multiply their cap.**

1. **C1 — Concurrent request race.** `assertWithinQuota` reads the count, much later writes the count. A `Promise.all([ask, ask, ask, ask, ask])` with all 5 reading "used = 1, limit = 2" lets all 5 pass. Pro becomes meaningless the moment any client (or any reverse-engineered API call) uses parallelism.

2. **C2 — Stream-abort under-billing.** `recordUsage` only runs on the `done` event. A scripted attacker closes the SSE connection at the first `token` event and burns Gemini cost without it counting against quota. Unlimited free spend at our expense.

Both close with a single change: write a reservation row inside `assertWithinQuota` so in-flight requests count, and reconcile it on `done`/`finally`.

The other 4 launch-blockers are webhook hygiene (no idempotency, optional secret, missing two required event handlers). Each is a small surface but the combined consequence of getting them wrong is silently losing money — a worse failure mode than crashing.

---

## CRITICAL

### C1. Concurrent-request race breaks the quota cap

**Files:** `backend/src/modules/ai/quota.ts:118-139`, `backend/src/modules/ai/service.ts:343-353`

#### What's wrong

```typescript
// quota.ts — current
export async function assertWithinQuota({ userId, tier, kind }): Promise<void> {
  const used = await AiUsageLog.countDocuments({ userId, date: today, kind });
  if (used >= limit) throw new AppError(402, ...);
}

// service.ts — current
// (much later, on the `done` SSE event)
await recordUsage({ userId, tier, kind, ... });  // AiUsageLog.create
```

`countDocuments` is a read. `recordUsage` is a write. Between the two, the request streams for 2-5 seconds. Any other request in that window sees the pre-write count.

#### Why it matters

A free user at `used=1, limit=2`:

```javascript
await Promise.all([
  fetch('/ai/ask', {body: question1}),
  fetch('/ai/ask', {body: question2}),
  fetch('/ai/ask', {body: question3}),
  fetch('/ai/ask', {body: question4}),
  fetch('/ai/ask', {body: question5}),
]);
```

All 5 reads return `used=1`, all 5 pass `1 < 2`, all 5 stream, all 5 record. Final state: `used=6, limit=2`. The user just got 5× their quota. **The Pro tier becomes meaningless the moment any client uses parallelism.**

This isn't theoretical — any attacker who reads our network tab finds the endpoint and writes the 5-line script above.

#### The fix

Use a separate `AiUsageCounter` collection as the atomic gatekeeper. Per `(userId, date, kind)` tuple, store an integer counter with a unique compound index. Reserve with:

```typescript
const result = await AiUsageCounter.findOneAndUpdate(
  { userId, date, kind, count: { $lt: limit } },
  { $inc: { count: 1 } },
  { upsert: true, new: true }
);
if (!result) throw new AppError(402, 'quota_exceeded', ...);
```

Mongo serializes the writes. The first N requests increment, the (N+1)th sees the filter mismatch and throws 402. Real token accounting still lands in `AiUsageLog` on `done` — but the counter is what gates.

#### How to verify

Test: fire 10 parallel `assertWithinQuota` calls for a user with limit=2. Assert exactly 2 succeed and 8 throw 402.

---

### C2. Stream-abort = unmetered Gemini spend

**Files:** `backend/src/modules/ai/service.ts:236-381`

#### What's wrong

`recordUsage` only fires inside the `event.kind === 'done'` branch. If the stream errors out, or the user aborts the SSE connection mid-stream, no row is written. But Gemini already generated the tokens — **we paid for them.**

#### Why it matters

A scripted attacker:

```javascript
const controller = new AbortController();
fetch('/ai/ask', { 
  body: JSON.stringify({question: "summarize " + URL}),
  signal: controller.signal,
});
// Wait for the first token event...
controller.abort();
// Repeat 1000×/day
```

Gemini charged us ~$0.013/turn for the URL-note path. 1000×/day = $13/day burned with zero record. Multiply by hostile users. **The cost ceiling we computed for the free tier ($1.20/user/month) evaporates.**

#### The fix

Combine with C1's reservation pattern: the counter increment happens at gate time, so even an aborted stream still counts against quota. The cost is attributed even if no `done` event fires.

Additionally, attach a `req.on('close')` handler to record aborted turns in `AiUsageLog` with `model: 'aborted'` so the audit trail is intact.

#### How to verify

Test: start an SSE stream, abort at the first token event, then call `assertWithinQuota` for the same user. Assert it correctly reflects 1 quota slot consumed.

---

### C3. No webhook event deduplication

**Files:** `backend/src/modules/billing/webhook.ts:63-81`

#### What's wrong

```typescript
switch (event.type) {
  case 'checkout.session.completed': await onCheckoutCompleted(...); break;
  case 'customer.subscription.created':
  case 'customer.subscription.updated':
  case 'customer.subscription.deleted': await onSubscriptionChanged(...); break;
}
res.json({ received: true });
```

Stripe delivers events **at least once**. The same `evt_xxx` arrives multiple times on:
- Network retries when our server is slow
- Our handler throws → Stripe retries with exponential backoff for 3 days
- Manual replay from the Stripe Dashboard
- Stripe's internal redundancy

Current code re-runs the handler every time.

#### Why it matters

Today's writes are accidentally idempotent (`$set` on a fixed value gives the same result twice). But this is fragile:
- Any future handler that increments a credit, sends an email, charges a fee, or grants entitlement runs twice
- A duplicate `invoice.paid` could double-credit a Pro user
- Logging is noisy and misleading

**This isn't a hypothetical — Stripe's own best-practices doc spends a section on this for a reason. Every Stripe-handling team gets bitten unless they deduplicate up front.**

#### The fix

```typescript
// New model: ProcessedWebhookEvent
{ eventId: string (unique index), processedAt: Date }
// TTL: 30 days

// In handler, after signature verification:
try {
  await ProcessedWebhookEvent.create({ eventId: event.id });
} catch (err) {
  if (err.code === 11000) {  // duplicate key
    logger.info({ eventId: event.id }, 'webhook: duplicate event, skipped');
    res.json({ received: true });
    return;
  }
  throw err;
}
// ... proceed to switch
```

#### How to verify

Integration test: fire two identical webhooks with the same `event.id`. Assert the User doc state matches what the handler would produce on a single delivery, and that the second handler call returns 200 without re-running business logic.

---

### C4. `STRIPE_WEBHOOK_SECRET` is `.optional()` in env

**Files:** `backend/src/lib/env.ts:59`, `backend/src/modules/billing/webhook.ts:44`

#### What's wrong

```typescript
// env.ts
STRIPE_WEBHOOK_SECRET: z.string().optional(),

// webhook.ts
if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
  res.status(400).send('Missing signature');
  return;
}
```

If `STRIPE_WEBHOOK_SECRET` is missing in production, the server boots silently. Every Stripe webhook returns 400 because we have no secret to verify against. Stripe retries for 3 days then gives up.

#### Why it matters

**Every subscription change is silently lost forever.** A user pays via Checkout. The webhook fires. We return 400. Stripe retries 7 times over 3 days. We return 400 every time. Stripe gives up. Our database never learns the user paid. The user is charged $9/mo for nothing.

No alarm fires. No log line stands out. The server is "healthy" from our monitoring's POV. We just slowly lose every paying customer's tier upgrade.

#### The fix

```typescript
// env.ts
STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required').optional(),
STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required').optional(),
```

Then a runtime guard in env.ts: if `NODE_ENV === 'production'` and either Stripe var is missing, refuse to boot. Dev stays optional so the rest of the app boots without Stripe configured.

#### How to verify

Manual: deploy with `STRIPE_WEBHOOK_SECRET` unset, confirm the server fails to start with a clear error message naming the missing variable.

---

### C5. No `invoice.payment_failed` handler

**Files:** `backend/src/modules/billing/webhook.ts:63-76`

#### What's wrong

When a customer's card fails on a renewal charge, Stripe fires `invoice.payment_failed` first. Only later (depending on Smart Retries configuration) does Stripe move the subscription to `past_due` and fire `customer.subscription.updated`. The gap can be hours.

#### Why it matters

1. **During the gap, the user retains Pro features they're no longer paying for.** Small dollar amount per incident, but it's revenue leakage we control.
2. **No dunning email goes out** — the user has no idea their card failed until they notice they were charged $9 they didn't expect / weren't charged $9 they did expect.
3. **Stripe's docs explicitly list this as a required event for any subscription product.**

#### The fix

```typescript
case 'invoice.payment_failed':
  await onInvoicePaymentFailed(event.data.object);
  break;

// handler:
async function onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // Don't downgrade here — let customer.subscription.updated handle that
  // when Stripe officially flips to past_due. This handler exists for:
  //   1. logging the failure for ops visibility
  //   2. triggering a "your card failed" email (TODO when email is wired)
  logger.warn({ invoiceId: invoice.id, customerId: invoice.customer }, 
    'stripe: invoice payment failed');
}
```

#### How to verify

Manual: use Stripe CLI `stripe trigger invoice.payment_failed` and confirm the warn log fires with the right customer id.

---

### C6. No `invoice.payment_action_required` handler

**Files:** `backend/src/modules/billing/webhook.ts:63-76`

#### What's wrong

EU customers' cards trigger SCA (Strong Customer Authentication, 3D Secure) on renewals. Stripe Checkout handles SCA for the initial signup. **Renewals require us to email the customer the `hosted_invoice_url` so they can complete authentication.** If we don't, the invoice sits in `requires_action` indefinitely.

#### Why it matters

**Mandatory for any EU customer.** Without this, every EU Pro user will eventually have a renewal fail silently and lose access — and they'll have no idea why. They'll think we're broken. We'll lose them.

#### The fix

```typescript
case 'invoice.payment_action_required':
  await onInvoicePaymentActionRequired(event.data.object);
  break;

async function onInvoicePaymentActionRequired(invoice: Stripe.Invoice): Promise<void> {
  // Email the customer with the hosted_invoice_url so they can complete SCA.
  // Today we just log — wire to email when the email service ships.
  logger.warn({
    invoiceId: invoice.id,
    customerId: invoice.customer,
    hostedUrl: invoice.hosted_invoice_url,
  }, 'stripe: invoice requires customer payment action (SCA)');
}
```

#### How to verify

Manual: use Stripe test cards that require authentication (`4000 0027 6000 3184`) and confirm the warn log fires with the hosted invoice URL.

---

## HIGH

### H1. Concurrent customer-creation race

**Files:** `backend/src/modules/billing/service.ts:128-143`

#### What's wrong

```typescript
async function ensureStripeCustomer(userId: string): Promise<string> {
  const live = await resolveLiveCustomerId(userId);  // returns null if missing
  if (live) return live;
  // ↓ race window: two concurrent calls both reach here
  const customer = await stripe.customers.create({ email, metadata: { userId } });
  await User.findByIdAndUpdate(userId, { $set: { 'billing.stripeCustomerId': customer.id } });
  return customer.id;
}
```

Two parallel `POST /billing/checkout-session` calls for the same userId both pass `resolveLiveCustomerId` (no cached id), both call `stripe.customers.create`, and both write back. The sparse-unique index doesn't help — `findByIdAndUpdate` with `$set` on an existing value doesn't throw a duplicate-key error; it just overwrites.

#### Why it matters

User ends up with two Stripe customers, one orphaned. If the orphan gets a subscription (because the user happened to checkout while it was the "winning" customer), it's hidden from our app forever. Charges appear on the user's card; we don't credit them. Refund nightmare.

#### The fix

Atomic claim before calling Stripe:

```typescript
// Try to win the race for "this user needs a Stripe customer"
const claimResult = await User.findOneAndUpdate(
  {
    _id: userId,
    $or: [
      { 'billing.stripeCustomerId': null },
      { 'billing.stripeCustomerId': { $exists: false } },
    ],
  },
  { $set: { 'billing.stripeCustomerId': '__pending__' } },  // sentinel
  { new: false }
);

// If we didn't win, someone else is creating — re-read.
if (!claimResult || claimResult.billing?.stripeCustomerId !== null) {
  // ... handle by reading the now-populated id
}

// We won — create in Stripe and write the real id
const customer = await stripe.customers.create(...);
await User.findByIdAndUpdate(userId, { $set: { 'billing.stripeCustomerId': customer.id } });
```

(Simpler alternative: `async-mutex` keyed by userId for in-process serialization. Works for single-instance deploys.)

#### How to verify

Test: fire 5 parallel `ensureStripeCustomer(userId)` calls. Assert `stripe.customers.create` was called exactly once.

---

### H2. No rate limiting on billing endpoints

**Files:** `backend/src/modules/billing/routes.ts`, `backend/src/app.ts`

#### What's wrong

Authenticated user (or stolen session cookie) can flood `POST /billing/checkout-session`. Each call triggers Stripe API calls.

#### Why it matters

- Burns our Stripe API rate quota
- Creates thousands of abandoned Checkout sessions visible in Dashboard
- Wastes our Stripe API quota window for legitimate users
- Could be used as an amplification/DoS vector

#### The fix

```typescript
import rateLimit from 'express-rate-limit';
const billingLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => req.userId ?? req.ip,
});
billingRouter.post('/checkout-session', requireAuth, billingLimiter, ...);
billingRouter.post('/portal-session', requireAuth, billingLimiter, ...);
```

#### How to verify

Test: 10 sequential requests from same userId — 6th onward returns 429.

---

### H3. Cleanup script has no prod guard

**Files:** `backend/scripts/clear-stale-stripe-customers.ts:23-29`

#### What's wrong

```typescript
async function main(): Promise<void> {
  await connectDb();  // uses MONGODB_URI from env
  await User.updateMany(...);  // wipes every user's stripeCustomerId
}
```

Comment says "do not run in production" but no programmatic guard. An engineer with prod env loaded on their laptop accidentally invokes this and wipes every user's Stripe link.

#### Why it matters

The self-healing customer recovery flow we built is **dependent on this script not having run.** If it does, every user's portal opens slowly (need to recover via metadata search), and any user whose Stripe customer was deleted (vs just unlinked) loses access entirely.

#### The fix

```typescript
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: refusing to run in production. NODE_ENV=' + process.env.NODE_ENV);
    process.exit(1);
  }
  if (!process.argv.includes('--force')) {
    console.error('FATAL: this script wipes every user\'s Stripe customer link.');
    console.error('Pass --force to confirm. Make sure MONGODB_URI is your dev DB:');
    console.error('  MONGODB_URI=' + (process.env.MONGODB_URI || '(unset)'));
    process.exit(1);
  }
  // ... existing logic
}
```

#### How to verify

Manual: try to run with `NODE_ENV=production npx tsx scripts/clear-stale-stripe-customers.ts` — confirm it refuses. Try without `--force` — confirm it refuses. Pass `--force` in dev — confirm it works.

---

### H4. Day-bucket race at UTC midnight

**Files:** `backend/src/modules/ai/quota.ts:123`, `backend/src/modules/ai/service.ts:568`

#### What's wrong

```typescript
// quota.ts (at gate time)
const today = utcDateBucket();  // reads new Date()

// service.ts (much later, at write time)
date: utcDateBucket(),  // reads new Date() again
```

A request that gates at 23:59:59.9 UTC reads `today = "2026-05-17"`, streams for 3 seconds, writes its log row with `date = "2026-05-18"`. The "2026-05-18" bucket starts at `used=0` even though the user just spent a slot.

#### Why it matters

Easy to exploit by clock-watching. A user with `used=29, limit=30` waits for 23:59:55 UTC, fires their last request, and gets a fresh day at `used=0` two seconds later. They effectively got +1 message/day.

Small per-user, but it's a deterministic exploit anyone reading the docs can find.

#### The fix

Compute `today` once at gate time, pass it through both functions:

```typescript
// routes.ts
const today = utcDateBucket();
await assertWithinQuota({ userId, tier, kind, today });
for await (const event of ask({ ..., today })) { ... }
// service.ts
await recordUsage({ ..., date: args.today });
```

Combined with the C1+C2 reservation pattern, this becomes automatic — the reservation row's `date` is set at gate time and the reconciliation update keeps it.

#### How to verify

Test: mock `Date.now()` to straddle UTC midnight (gate at 23:59:59, write at 00:00:01). Assert the write lands in the same bucket the gate checked.

---

### H5. Pro grace period after cancel ignores `currentPeriodEnd`

**Files:** `backend/src/modules/ai/routes.ts:28-31`, `backend/src/modules/billing/webhook.ts:16-25`

#### What's wrong

```typescript
// resolveTier:
return user?.billing?.subscriptionTier === 'pro' ? 'pro' : 'free';
```

On `customer.subscription.deleted` (user clicked "cancel"), the webhook flips `subscriptionTier` to `'free'` immediately. The user paid through `currentPeriodEnd` (say, 25 days from now) but loses access NOW.

#### Why it matters

**Chargeback risk.** Industry-standard subscription UX is "Pro until period end." Stripe even ships their Billing Portal with this assumption by default ("Cancel at end of period"). If we ignore `currentPeriodEnd`, users feel cheated, dispute the charge, and we lose the dispute AND eat a $15 chargeback fee on top of the refund.

#### The fix

```typescript
async function resolveTier(userId: string): Promise<'free' | 'pro'> {
  const user = await User.findById(userId)
    .select('billing.subscriptionTier billing.subscriptionStatus billing.currentPeriodEnd')
    .lean();
  const billing = user?.billing;
  if (billing?.subscriptionTier !== 'pro') return 'free';
  const status = billing.subscriptionStatus;
  const periodEnd = billing.currentPeriodEnd;
  // Active sub → Pro
  if (status === 'active' || status === 'trialing') return 'pro';
  // Past-due → Pro during the grace window (already handled in TIER_BY_STATUS)
  if (status === 'past_due') return 'pro';
  // Canceled → Pro until current_period_end lapses
  if (status === 'canceled' && periodEnd && periodEnd.getTime() > Date.now()) return 'pro';
  return 'free';
}
```

#### How to verify

Test: user with `subscriptionTier='pro', subscriptionStatus='canceled', currentPeriodEnd=now+10days` resolves to `'pro'`. Same user with `currentPeriodEnd=now-1day` resolves to `'free'`.

---

### H6. URL-fetch failure classification mismatch

**Files:** `backend/src/modules/ai/service.ts:544-550`, `backend/src/modules/ai/quota.ts:70-72`

#### What's wrong

- Pre-flight `classifyRequestKind` counts any URL in the question as `url_note`
- Post-stream `classifyTurnKind` only records `url_note` when fetch actually succeeded AND `createNote` ran

A user whose URL fails SSRF check or returns 404 gets pre-gated against the strict `url_note` cap, but the row is recorded as `message`.

#### Why it matters

User can game this:
- Submit URL that 404s → counts against `message` cap (cheaper)
- But pre-gate counts against `url_note` cap → free user gets locked out of URL features early

Both directions are wrong:
- We over-charge legitimate users who pasted a broken link
- We under-charge users who deliberately link to broken URLs as a cap-bypass

#### The fix

Write the reservation as `pending`, reclassify on `done` based on what actually happened. Update the reservation row to the correct kind before counting against quota.

Simpler alternative (since classification differences are real): record both pre-gate and post-stream kinds on the row, query quota using the post-stream kind (the one that reflects reality).

#### How to verify

Test: submit a URL that returns 404. Assert it counts against `message` quota, not `url_note`.

---

### H7. Token counts not clamped

**Files:** `backend/src/modules/ai/service.ts:347-350`

#### What's wrong

```typescript
promptTokens: event.usage.promptTokenCount ?? 0,
outputTokens: event.usage.candidatesTokenCount ?? 0,
```

Gemini occasionally returns negative values (`-1` on `MAX_TOKENS`-truncated responses, observed in their SDK). We write the negative number straight into Mongo.

#### Why it matters

Corrupts the only paper trail used for:
- Chargeback disputes ("how much did this user actually use?")
- Cost reconciliation against Gemini's billing
- Per-user cost analytics

Negative values cascade — sum of column goes wrong, dashboards break.

#### The fix

```typescript
promptTokens: Math.max(0, event.usage.promptTokenCount ?? 0),
outputTokens: Math.max(0, event.usage.candidatesTokenCount ?? 0),
```

Plus schema-level guard: `{ type: Number, required: true, default: 0, min: 0 }` on AiUsageLog.

#### How to verify

Test: pass `event.usage.promptTokenCount = -5` and confirm the persisted row has `promptTokens: 0`.

---

### H8. No `charge.dispute.created` handler

**Files:** `backend/src/modules/billing/webhook.ts:63-76`

#### What's wrong

A customer who disputes a charge keeps Pro access indefinitely. Once Stripe sees the dispute, they pull the money from our account — but we never know to revoke the user's access.

#### Why it matters

- Bad-faith user can buy Pro, use it, dispute the charge, keep using it forever
- Compounds because they can do this for multiple months in a row before we notice the trend in Stripe Dashboard
- Even good-faith disputes (genuine fraud claims from card holders who didn't authorize the charge) should trigger access revocation

#### The fix

```typescript
case 'charge.dispute.created':
  await onDisputeCreated(event.data.object);
  break;
case 'charge.dispute.closed':
  await onDisputeClosed(event.data.object);
  break;

async function onDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  // Revoke access immediately on any dispute. If we win the dispute,
  // the closed handler restores access.
  await downgradeUserByCustomerId(dispute.charge, 'dispute');
  logger.warn({ disputeId: dispute.id }, 'stripe: dispute opened, user downgraded');
}

async function onDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
  if (dispute.status === 'won') {
    // Restore access — but be careful, the user might have also canceled.
    // Read the current subscription status from Stripe and re-sync.
  }
}
```

#### How to verify

Manual: Stripe Dashboard "Create dispute" → confirm user's tier flips to `free`.

---

### H9. `past_due → pro` grace period needs Smart Retries config

**Files:** `backend/src/modules/billing/webhook.ts:19`

#### What's wrong

`TIER_BY_STATUS[past_due] = 'pro'` is a deliberate grace-period choice. Stripe themselves recommend it (don't lock features the moment a card fails — give the customer a chance to update payment method).

**But Stripe's default Smart Retries window can be up to 2 months long.** That's 2 months of free Pro access for someone with a permanently dead card.

#### Why it matters

Not a code bug — a configuration bug. The code is right; the missing piece is the Dashboard setting.

#### The fix

Dashboard → Billing → Settings → Revenue recovery:
- Enable Smart Retries
- Set "After all retries fail" to "Cancel subscription" (which fires `customer.subscription.deleted` that our webhook handles correctly)
- Recommended retry schedule: 4 attempts over ~3 weeks

No code change.

#### How to verify

Manual: confirm Dashboard setting matches the recommendation. Document the chosen retry policy in this file.

---

### H10. Pre-launch Stripe setup gaps (Dashboard work)

Per Stripe's go-live checklist, these can't be code:

- **Restricted API key** — currently using full `STRIPE_SECRET_KEY`. Create restricted key with only Subscriptions / Customers / Checkout / Portal scopes. Limits blast radius if the key leaks.
- **Live webhook endpoint** — register the production URL in Stripe Dashboard live mode. Copy the live `STRIPE_WEBHOOK_SECRET` (different from test mode!).
- **Stripe Tax** — required for EU VAT. Enable in Dashboard, add `automatic_tax: { enabled: true }` to checkout session creation.
- **Production Price ID** — current `STRIPE_PRICE_PRO_MONTHLY` is a test-mode object. Recreate product + price in live mode.

See `docs/audits/stripe-go-live-checklist.md` for the full setup runbook.

---

## MEDIUM

| # | What | File | Fix |
|---|------|------|-----|
| M1 | No quota on `/ai/tools/confirm/:callId` — `generateExam` second Gemini call isn't recorded | `routes.ts:325-364` | Write usage row inside `runConfirmedTool` for tools that call Gemini |
| M2 | Stripe metadata search interpolation is a future-footgun (safe today only because userId is always ObjectId) | `service.ts:59` | Assert `/^[0-9a-f]{24}$/i.test(userId)` before search |
| M3 | Search may return multiple customers; code blindly picks `data[0]` | `service.ts:58-62` | If `data.length > 1`, log warn + return null |
| M4 | `coerceStatus` overwrites Stripe `paused` as `canceled` (User enum doesn't include `paused`) | `webhook.ts:32-35`, `User.ts:26-30` | Add `paused` to enum, handle explicitly |
| M5 | Missing `customer.deleted` and `charge.refunded` handlers | `webhook.ts` | Handle both — null out cached id / revert tier |
| M6 | `recordUsage` failure swallowed silently — degraded Mongo = unlimited turns | `service.ts:351-353` | Emit metric + alert; keep graceful degradation |
| M7 | 35-day TTL on `AiUsageLog` too short for chargeback disputes (Stripe allows 60-120 days) | `AiUsageLog.ts:59` | Extend to 120 days, or ship the daily-rollup |
| M8 | `returnPath` allows `//evil.com` (protocol-relative URLs) — not exploitable today but fragile | `routes.ts:34-43` | Add `.regex(/^\/[^/]/)` to schema |

---

## LOW / Notes

- API version is pinned (`'2026-04-22.dahlia'` at `stripe-client.ts:21`) ✅
- Frontend `useAiQuota` is purely advisory — server is the gatekeeper ✅
- IDOR: no endpoint accepts userId from request body/query/params ✅
- All four billing routes are behind `requireAuth` ✅
- Webhook endpoint correctly bypasses auth (Stripe can't send cookies) ✅
- Stripe error details don't leak in API responses ✅
- `extractUrls` correctly classifies `bit.ly` as a URL ✅
- Tier on `AiUsageLog` frozen at write time (historical accounting survives downgrades) ✅
- Webhook handler latency well under Stripe's 30s timeout ✅

---

## What we got RIGHT

- **Raw body parser** scoped inline to webhook route, mounted before `express.json()` — the #1 Stripe webhook footgun is absent
- **Signature verification** before any business logic; returns 400 (not retried), not 500 (retried)
- **Self-healing customer recovery** via metadata search is genuinely good defensive code
- **Sparse-unique index** on `billing.stripeCustomerId` provides DB-level backstop
- **Stripe API version pinned** in the SDK constructor
- **Tier source of truth** is server-side Mongo, never the client
- **402 returned before SSE opens** — clean error envelope with structured upgrade-prompt details
- **Quota gate AND model selection** use the same server-resolved tier
- **SSRF protection** on URL fetch prevents the URL-note pipeline from becoming a cloud-metadata probe
- **Compound index** `(userId, date, kind)` covers the hot quota query
- **Webhook handler is stateless** — no ordering dependencies, `$set`-only writes are safely idempotent
- **Error responses are sanitized** — no Stripe IDs leaked

---

## Implementation order (ROI-ranked)

If only the first six ship, the product is safe to take real money.

1. **C1 + C2** — Reservation-row pattern. Closes both quota holes with one change. **Highest leverage by far.**
2. **C3** — Webhook idempotency with `ProcessedWebhookEvent` model.
3. **C4** — Required env vars for Stripe secrets.
4. **C5 + C6** — Add `invoice.payment_failed` and `invoice.payment_action_required` handlers.
5. **H1** — Atomic customer creation.
6. **H5** — Honor `currentPeriodEnd` in `resolveTier`.

Then the second sprint:
7. **H3** — Cleanup script prod guard.
8. **H7** — Clamp token counts.
9. **H8** — Dispute handlers.
10. **M2-M8** — Polish.

Then Dashboard work (H10):
11. Restricted key + live webhook endpoint + Stripe Tax + live price ID

---

## Methodology

Four parallel sub-agents, read-only, ~5 minutes wall time:

1. **Webhook security** (security-reviewer agent) — signature verification, idempotency, event ordering, retry behavior, missing events, timing
2. **Billing service & authz** (security-reviewer agent) — Stripe query injection, IDOR, open redirect, customer-creation races, error leakage, secret handling
3. **Quota enforcement** (general-purpose agent) — bypass vectors, race conditions, downgrade timing, frontend trust boundary
4. **Stripe production readiness** (librarian agent) — fetched current Stripe docs, diffed against our implementation

Findings consolidated and ranked by ROI. Conflicts resolved by trusting file-reading agents over web-research agents.
