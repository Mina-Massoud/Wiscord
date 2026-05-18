# Subscription UX & Extensibility Review — 2026-05-18

**Status:** Post-Phase-3 follow-up audit. The prior [payments-flow audit](./2026-05-18-payments-flow-audit.md) closed correctness gaps (webhook idempotency, atomic customer creation, cancel grace, etc.). This pass focuses on the four explicit user concerns:

1. Best practices + extensibility (can we add annual / team / trial / coupon without a rewrite?)
2. User UX is best
3. Every state is green or red (no ambiguous "unknown" rendering)
4. **The "user can't pay and see nothing" failure mode**

**Auditors:** 4 parallel sub-agents (architect, code-explorer, silent-failure-hunter, frontend UX), read-only.

**Result:** **2 launch-blockers**, 7 highs, 9 mediums. The dominant theme: **a paying user can sit on the Settings panel seeing "Free" for 5–30 seconds after a successful checkout** because no surface has a "verifying your payment" interstitial. Combined with denormalized-tier reads, a Pro-grace user also sees "Free" in Settings while the AI correctly grants Pro access. Both fix to the same pair of small changes.

---

## How to read

Same format as the prior audit. Each finding lists **What's wrong / Why it matters / Fix / Verify**. Severity:

| Level | Meaning | Gate |
|-------|---------|------|
| CRITICAL | Block launch | Must ship before any non-friend pays |
| HIGH | Bug or significant risk | Should ship before first 10 paying customers |
| MEDIUM | Correctness or maintainability | Should ship before first 100 |
| LOW | Notes / backlog | Backlog |

Items prefixed with `↳` extend an existing finding from the prior audit rather than introducing a new one.

---

## Executive summary

Two things make a paying user see "Free":

1. **`CheckoutReturnHandler` toasts "Welcome to Pro" immediately and runs a one-shot query invalidation.** The webhook is typically 2–30 seconds behind the redirect. Until the webhook lands, `GET /billing/subscription` returns `tier:'free'` from Mongo. There is no polling, no "verifying…" interstitial, no `staleWhileRevalidate`. The toast says Pro, the UI says Free. **(C1)**

2. **`getSubscription` returns the denormalized `subscriptionTier` field directly** instead of going through `resolveEffectiveTier`. A user mid-cancel-grace gets `tier:'free'` in the Settings panel (and thus the "Upgrade $9/mo" CTA) while `/ai/quota` correctly returns `pro` because that path uses the resolver. The API disagrees with itself. **(C2)**

These two close ~80% of the user-facing UX complaints with two small surgical changes. Everything else below is incremental hardening.

The extensibility picture is mostly healthy: tier is well-typed, status transitions are explicit, and the webhook surface is complete. The one structural gap is **`QUOTAS` and `TIER_BY_STATUS` are hardcoded maps**, so adding a third tier (Pro Plus, annual variant, lifetime) is a 6-file sweep. A small **plans registry** abstraction would convert L/M extensions to S.

---

## CRITICAL

### C1. Paying user sees "Free" UI for up to 30s after checkout

**Files:** `frontend/src/components/billing/CheckoutReturnHandler.tsx:22-37`, `frontend/src/queries/billing.ts:29`

#### What's wrong

```tsx
useEffect(() => {
  if (params.get('checkout') !== 'success') return;
  void qc.invalidateQueries({ queryKey: qk.billing.root });
  toast.success('Welcome to Wiscord Pro 🎉');
  // ... strip the query param, exit
}, [...]);
```

One-shot invalidation. The refetch hits `GET /billing/subscription`, which reads Mongo. But Stripe's webhook delivery is asynchronous — typical lag 2–10 seconds, can be 30+ in worst case. During that window, Mongo still has `subscriptionStatus: 'none', tier: 'free'`. The query settles with Free data.

Then `useSubscription`'s default `staleTime: 30_000` means no automatic refetch fires for 30 seconds. The webhook may land at second 8 — the UI doesn't know.

#### Why it matters

This is the literal "user can't pay and see nothing" scenario:

- Toast says "Welcome to Wiscord Pro 🎉"
- `UserPanelProBadge` renders nothing (because `data?.tier !== 'pro'`)
- `SubscriptionPanel` says "You're on Free" with an "upgrade · $9/mo" CTA
- `AiQuotaHint` shows Free quota limits
- User tries to ask their 3rd AI message → hits the Free cap they just paid to remove
- User contacts support thinking the upgrade failed

The handler resets the URL query param after firing, so a page reload doesn't re-toast or re-poll. User is stuck until either focus-refetch or 30s staleness elapses.

#### The fix

A short-lived poll after `?checkout=success` is detected. Two viable shapes:

**Option A — `refetchInterval` until tier flips:**
```tsx
const { data } = useSubscription({
  refetchInterval: (q) =>
    isInPostCheckoutWindow && q.state.data?.tier !== 'pro' ? 1500 : false,
});
```

**Option B — explicit polling effect with budget:**
```tsx
// In CheckoutReturnHandler, after stripping the query param:
const start = Date.now();
const tick = async () => {
  await qc.invalidateQueries({ queryKey: qk.billing.root });
  const fresh = qc.getQueryData<SubscriptionResponse>(qk.billing.root);
  if (fresh?.tier === 'pro') return;
  if (Date.now() - start > 30_000) {
    toast.info('Payment confirmed — Pro should appear in a minute. Refresh if it doesn\'t.');
    return;
  }
  setTimeout(tick, 1500);
};
toast.success('Activating Wiscord Pro…');
tick();
```

Also: surface a `verifying` state in `SubscriptionPanel` when the user is in the post-checkout poll window, so the panel doesn't flash "You're on Free" while we're confirming.

#### How to verify

Manual: open Stripe Checkout in test mode with a card that pays in 5 seconds (`4000 0000 0000 0077` succeeds with a delay). Complete payment, redirect lands on `/app?checkout=success`. The panel should show "Activating Pro…" until the webhook lands, then flip to "Pro" — never showing "You're on Free" with an upgrade CTA.

---

### C2. `getSubscription` ignores the effective-tier resolver — cancel-grace users see "Free"

**Files:** `backend/src/modules/billing/service.ts:42-51`

#### What's wrong

```ts
export async function getSubscription(userId: string): Promise<SubscriptionResponse> {
  const user = await loadUser(userId);
  const billing = user.billing ?? {};
  return {
    status: billing.subscriptionStatus ?? 'none',
    tier: billing.subscriptionTier ?? 'free',  // ← reads denormalized field
    currentPeriodEnd: billing.currentPeriodEnd ? billing.currentPeriodEnd.toISOString() : null,
    hasCustomer: !!billing.stripeCustomerId,
  };
}
```

`billing.subscriptionTier` is denormalized — on `customer.subscription.deleted`, the webhook writes `subscriptionTier: 'free'` immediately, even though the user is still in their paid grace window. The H5 fix added `resolveEffectiveTier` to handle this correctly — but **`getSubscription` skips the resolver**. Meanwhile, `/ai/quota` goes through `resolveTier` → `resolveEffectiveTier`, so the two endpoints disagree.

#### Why it matters

A user who clicks cancel mid-billing-cycle:

- `/ai/quota` returns `tier: 'pro'` (correct — they paid for the month)
- `/billing/subscription` returns `tier: 'free'` (wrong)
- Settings panel shows the "upgrade · $9/mo" CTA (wrong)
- `UserPanelProBadge` is absent (wrong — they're still Pro)
- AI features still work (correct)

This is the inverse of C1: not "I paid but see Free", but "I paid for a month, cancelled, and now Settings tells me to pay again." Same user-impact category — paying user sees Free UI.

#### The fix

Pipe `getSubscription` through `resolveEffectiveTier`:

```ts
import { resolveEffectiveTier } from './effective-tier.js';

export async function getSubscription(userId: string): Promise<SubscriptionResponse> {
  const user = await loadUser(userId);
  const billing = user.billing ?? {};
  return {
    status: billing.subscriptionStatus ?? 'none',
    tier: resolveEffectiveTier(billing),  // ← respect the grace window
    currentPeriodEnd: billing.currentPeriodEnd ? billing.currentPeriodEnd.toISOString() : null,
    hasCustomer: !!billing.stripeCustomerId,
  };
}
```

Now the API speaks with one voice. `SubscriptionPanelStatusBanner` already renders the "Your Pro access ends on …" copy correctly when status is `canceled` + `currentPeriodEnd` is in the future, so the user sees the right "Pro until <date>" message instead of an upgrade prompt.

#### How to verify

Unit test: a billing subdoc with `status:'canceled', tier:'free', currentPeriodEnd: now + 10 days` returns `tier:'pro'` from `getSubscription`. Same subdoc with `currentPeriodEnd: now - 1 day` returns `tier:'free'`.

---

## HIGH

### H1. Event ordering race — `subscription.created` before `checkout.session.completed`

**Files:** `backend/src/modules/billing/webhook-handlers.ts:71-83, 85-110`

Stripe doesn't guarantee `checkout.session.completed` arrives before `customer.subscription.created`. If the subscription event lands first, `onSubscriptionChanged` does `findOneAndUpdate({ 'billing.stripeCustomerId': customerId })`. The customerId hasn't been written yet → returns `null` → `logger.warn` → handler exits. The tier write is lost. `checkout.session.completed` only writes the customerId, never the tier. **The user paid but their tier never flips to Pro until the next subscription lifecycle event.**

**Fix:** in `onCheckoutCompleted`, also reconcile the tier by reading the subscription from Stripe and applying it. Either by calling `stripe.subscriptions.list({ customer, limit: 1 })` and writing the result, or by registering a deferred re-fetch. Atomic write:

```ts
export async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = ...;
  const userId = session.metadata?.userId;
  if (!userId) { logger.error(...); return; }  // H4 — error not warn
  await User.findByIdAndUpdate(userId, { $set: { 'billing.stripeCustomerId': customerId } });
  if (session.subscription) {
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const sub = await getStripe().subscriptions.retrieve(subId);
    await onSubscriptionChanged(sub);  // applies tier/status/periodEnd in one shot
  }
}
```

This makes the checkout handler self-sufficient — even if `customer.subscription.created` raced ahead and warn-skipped, this back-fills the state. Webhook idempotency (C3 from prior audit) keeps it safe to re-run.

**Verify:** integration test that fires events in reverse order (`subscription.created` first, then `checkout.session.completed`) and asserts the user ends up Pro.

---

### H2. `UserPanelProBadge` collapses loading/error/free into `null`

**Files:** `frontend/src/components/app-shell/UserPanelProBadge.tsx:19-21`

```tsx
const { data } = useSubscription();
if (data?.tier !== 'pro') return null;
```

Three different states render identically: loading (no data yet), error (`data` is undefined), and "user is actually Free". A paying Pro user with a transient network blip sees their badge disappear, which feels like a downgrade.

**Fix:** destructure `isError` and last-known-good state. When the prior render had `tier === 'pro'` and the next fetch errors, keep showing the badge. TanStack Query already preserves `data` across errors by default — just stop collapsing the three states.

```tsx
const { data, isLoading } = useSubscription();
if (isLoading) return <BadgeSkeleton />;
if (data?.tier !== 'pro') return null;
return <ProBadge expiresAt={data.currentPeriodEnd} />;
```

**Verify:** in dev, throttle `/billing/subscription` to 30s. Badge shows skeleton then renders. Force the endpoint to 500. Badge stays visible from the last successful state.

---

### H3. `SubscriptionPanel` error state has no retry CTA

**Files:** `frontend/src/components/settings/panels/SubscriptionPanel.tsx:81-89`

The error branch renders "couldn't load your subscription. try refreshing the dialog." but no button. User has to close+reopen Settings.

**Fix:** expose `useSubscription().refetch()` as a button. Standard error-state pattern.

---

### H4. `onCheckoutCompleted` missing `userId` logs at warn, not error

**Files:** `backend/src/modules/billing/webhook-handlers.ts:71-77`

```ts
if (!customerId || !userId) {
  logger.warn({ session: session.id }, 'checkout.session.completed missing customer/userId');
  return;
}
```

`!customerId` is a known timing race (covered by H1 fix and idempotent retries). **`!userId` is a code-level bug** — `createCheckoutSession` always sets `metadata.userId`. If it's missing, something is genuinely broken. Same log line, same severity → indistinguishable in alerting.

**Fix:** split the conditions. `logger.error` when `!userId` (misconfiguration, needs alert), `logger.warn` when only `!customerId` (known race, expected).

---

### H5. `recordUsage` write failure → no alert, no audit trail

**Files:** `backend/src/modules/ai/service.ts:349-362`

`catch { logger.warn(...) }` swallows AiUsageLog write failures. The quota counter (separate atomic gate via `AiUsageCounter`) still fires, so this isn't a quota bypass — but the audit log is lost. Cost reconciliation against Gemini's billing, per-user spend analytics, and chargeback dispute paper trail all read from `AiUsageLog`. A sustained Mongo write failure during peak usage silently corrupts those.

**Fix:** elevate to `logger.error` with a `lostUsageLog: true` structured field. Add a Datadog/Grafana alert rule on error count for the AI module. (Audit trail recovery is a separate, larger problem — but at least make the loss visible.)

---

### H6. `recoverCustomerByMetadata` hides Stripe auth failures behind `billing_no_customer`

**Files:** `backend/src/modules/billing/service.ts:100-106`

```ts
} catch (err) {
  logger.warn({ err, userId }, 'recoverCustomerByMetadata: search failed');
  return null;
}
```

Catches everything. A rotated `STRIPE_SECRET_KEY` or a 429 rate limit becomes `null` → caller returns `billing_no_customer` 400 to the user → user sees "No Stripe customer for this account yet" despite having an active subscription.

**Fix:** distinguish `authentication_error` / `rate_limit_error` / `api_error` from genuine-no-results. Throw the API errors so the route returns 502 `billing_stripe_unavailable`:

```ts
const code = (err as { code?: string; type?: string }).code;
const type = (err as { type?: string }).type;
if (type === 'StripeAuthenticationError' || type === 'StripeRateLimitError' || type === 'StripeAPIError') {
  throw new AppError(502, 'billing_stripe_unavailable', 'Stripe is temporarily unavailable.');
}
logger.warn(...);
return null;
```

---

### H7. Plans are hardcoded — adding a tier is a 6-file sweep

**Files:** `backend/src/db/models/User.ts:36`, `backend/src/modules/billing/webhook-handlers.ts:24` (TIER_BY_STATUS), `backend/src/modules/ai/quota.ts:19` (QUOTAS), `backend/src/modules/ai/service.ts:240`, `backend/src/modules/ai/context-builder.ts:202,562`, `frontend/src/components/settings/panels/SubscriptionPanel.tsx:32-36` (FEATURE_SWAPS), `backend/src/modules/billing/effective-tier.ts:35`

Adding annual / Pro Plus / Lifetime / Trial-as-its-own-tier touches every file above with a fresh branch. The tier enum is `'free' | 'pro'` everywhere — there's no abstraction.

**Fix:** small **plans registry** at `backend/src/modules/billing/plans.ts`:

```ts
export interface PlanDef {
  id: 'free' | 'pro' | 'pro_plus' /* ... */;
  displayName: string;
  priceIds: { monthly?: string; annual?: string };
  quotas: { message: number; url_note: number };
  models: { default: string; strong: string };
  features: { aiSources: boolean; voiceMinutes: number };
}

export const PLANS: Record<PlanId, PlanDef> = { /* ... */ };
```

Then:
- `quota.ts:QUOTAS` → derived from `PLANS[tier].quotas`
- `service.ts:240` `args.tier === 'pro' ? STRONG_MODEL : DEFAULT_MODEL` → `PLANS[tier].models.strong`
- `webhook-handlers.ts:TIER_BY_STATUS` → `tierFromPriceId(price)` lookup
- Frontend `FEATURE_SWAPS` → served from `GET /billing/plans` so copy can't drift from caps

Adding a tier becomes: one entry in `PlanId` union, one entry in `PLANS`. Annual / Lifetime / Pro Plus → S instead of M/L.

---

## MEDIUM

### M1. No focus-refetch on `useSubscription`

User cancels in Stripe Portal, returns to the app tab. Default `staleTime: 30_000` + default `refetchOnWindowFocus` means the panel can lie for up to 30s.

**Fix:** `refetchOnWindowFocus: 'always'` on `useSubscription`, or invalidate `qk.billing.root` on `visibilitychange`.

---

### M2. `AiQuotaHint` disappears at exactly 0 remaining

**Files:** `frontend/src/components/ai/AiQuotaHint.tsx:26-27`

```tsx
if (!data || remaining > 5 || remaining <= 0) return null;
```

The exact moment a user wants a heads-up — they've just hit the cap — the hint vanishes. The cap-hit is only communicated by the *next* attempt via `UpgradePromptDialog`.

**Fix:** add a "0 left — resets at <time>" pill at zero, distinct from the "X left" pre-cap chip.

---

### M3. `SubscriptionResponse.status` type is narrower than the User model

**Files:** `backend/src/modules/billing/schemas.ts:2`, `backend/src/db/models/User.ts:31`

Schema declares `'none' | 'active' | 'trialing' | 'past_due' | 'canceled'`. User model also stores `'unpaid' | 'paused'`. `service.ts:47` passes the raw field through with no narrowing. A `'paused'` value escapes the type — TS trusts the cast at the type boundary, runtime diverges.

**Fix:** widen the response type to match the model, or narrow at the service layer.

---

### M4. `incomplete*` coerce path can produce ambiguous Pro-grace

**Files:** `backend/src/modules/billing/webhook-handlers.ts:54, 63-69`

`coerceStatus` folds `incomplete` and `incomplete_expired` into `canceled`. `extractCurrentPeriodEnd` runs unconditionally — if Stripe returns a future `current_period_end` for an `incomplete` sub (rare but possible with trial setups), the user gets stored as `status:'canceled', tier:'free', periodEnd:future`. `resolveEffectiveTier` then returns `'pro'` because status is canceled and periodEnd is in the future. **A user who never successfully paid gets Pro until the trial period lapses.**

**Fix:** when coercing `incomplete*` → `canceled`, also zero out `currentPeriodEnd`. Incomplete subs aren't paid, so no grace is owed.

---

### M5. `onChargeDisputeCreated` no-ops when `dispute.charge` is a string

**Files:** `backend/src/modules/billing/webhook-handlers.ts:164-176`

```ts
const customerId = typeof dispute.charge === 'string' ? null : (dispute.charge?.customer as string | null);
if (!customerId) { logger.warn(...); return; }
```

Stripe's webhook payload shape depends on the Dashboard's object-expansion setting. If expansion isn't configured for `charge.dispute.*`, `dispute.charge` is a string id and the handler silently returns. The user disputes, keeps Pro access, you eat the chargeback fee.

**Fix:** when `charge` is a string, fetch it: `stripe.charges.retrieve(dispute.charge)`. Until that's done, log at `error` not `warn` (a silent dispute is money lost).

---

### M6. `SubscriptionPanelStatusBanner` past_due copy is not actionable

**Files:** `frontend/src/components/settings/panels/SubscriptionPanelStatusBanner.tsx:17-26`

Past_due banner says "Your last payment failed. Open the billing portal to update your payment method." — but the banner isn't a button. User has to find the "manage billing" CTA elsewhere on the panel.

**Fix:** wrap the past_due banner in a button that calls `useOpenPortal()` directly. Same for the cancel-grace banner (offer "Resubscribe").

---

### M7. `BillingPanel` error indistinguishable from empty invoices

**Files:** `frontend/src/components/settings/panels/BillingPanel.tsx:25-29`

The error message and the empty state share layout. A user with intermittent errors may assume they have no invoices.

**Fix:** distinct icon + retry button on error.

---

### M8. SCA handler is a permanent no-op

**Files:** `backend/src/modules/billing/webhook-handlers.ts:144-157`

`onInvoicePaymentActionRequired` only logs. EU users whose renewal requires 3D Secure get no email and no in-app notification. They eventually move to `past_due` and lose access.

**Fix:** elevate to `logger.error` until email is wired. Document `requiresManualIntervention: true` in the log fields so on-call can intervene. When email ships, this is P0.

---

### M9. `listInvoices` returns `[]` on Stripe API error

**Files:** `backend/src/modules/billing/service.ts:292-299`

Stripe API errors (auth, rate limit, network) get caught and surface as "no invoices" because `resolveLiveCustomerId` returns `null`. User sees their payment history disappear.

**Fix:** same as H6 — propagate Stripe API errors as 502 `billing_stripe_unavailable`.

---

## LOW

- `useAskAi` 401 isn't special-cased — falls into generic error toast. Should trigger boot-time `/auth/me` revalidation. (`queries/ai.ts:533-537`)
- `ProcessedWebhookEvent` has no TTL index. Already noted in prior audit's M-tier. Restate: 30-day TTL recommended; Stripe retries cap at ~3 days, so 30d is generous.
- `SubscriptionPanel` not locked when `hasCustomer: false` — checkout button works regardless, but if Stripe customer creation is in flight, edge-case 409s surface as generic toast.
- The `getSubscription` `customer.deleted` path clears `currentPeriodEnd: null` even when grace was active. Documented in webhook-handlers.ts:229 as deliberate. Acceptable but worth surfacing in a comment that this is the "customer wiped" intent vs the "user cancelled" intent.

---

## What's already RIGHT

Carrying forward from the agents' explicit "confirmed well-handled" notes — these were checked, no silent failure:

- **Webhook idempotency dedup** correctly differentiates duplicate (200 + `duplicate: true`) from first-delivery (200 + `received: true`). Stripe doesn't retry on 200.
- **`assertWithinQuota` is truly atomic** via Mongo `findOneAndUpdate` upsert + E11000 translation. No TOCTOU window. (C1/C2 from prior audit resolved.)
- **`resolveEffectiveTier` defaults to `'free'`** with documented justification per status — the `?? 'free'` here is intentional, not a silent failure mask.
- **`ensureStripeCustomer` orphan delete** uses `logger.warn` and continues because the worst case is a dangling test customer — the atomic Mongo claim already resolved the race.
- **`SubscriptionPanel` error branch** correctly distinguishes `error || !data` rather than defaulting to Free.
- **402 quota_exceeded parsing** safely degrades with a fallback when the body is malformed (`parseQuotaExceededBody`).
- **`AiCapsule` is tier-agnostic** — opens for everyone, paywall lives downstream in `UpgradePromptDialog`. Right design.
- **`useAskAi` is the most state-complete surface** — 8/10 of the rubric states explicitly handled including SSE abort discipline.
- **`StatusBanner` covers `past_due` and `canceled` grace explicitly** — H5 from prior audit confirmed shipping correctly through to the UI.

---

## Implementation order (ROI-ranked)

If only the first three ship, the "user can't pay and see nothing" UX is fixed.

1. **C1 + C2** — Post-checkout polling + `getSubscription` through resolver. Both small, surgical, close the dominant UX bug. **Highest leverage by far.**
2. **H1** — Event-ordering safety net in `onCheckoutCompleted`. Closes the silent race where subscription event lands before checkout event.
3. **H2 + H3** — `UserPanelProBadge` + `SubscriptionPanel` error states. Two tiny frontend changes that stop the "Pro user briefly looks Free" flashes.
4. **H4 + H5 + H6** — Logger level corrections + Stripe-error propagation. Makes silent failures visible to monitoring.
5. **H7** — Plans registry. Highest-ROI architecture investment. Converts every future tier addition from M/L → S. Worth doing before adding the annual plan.

Then medium-tier:
6. **M1 + M2 + M6 + M7** — Frontend polish (focus-refetch, 0-remaining hint, actionable banners, distinct error states).
7. **M3 + M4** — Type safety + incomplete-coerce edge case.
8. **M5 + M8** — Dispute + SCA hardening (deferred until charge expansion is configured + email service ships).

---

## Methodology

Four parallel sub-agents, read-only, ~5–8 minutes wall time:

1. **Architect** — state matrix, drift surfaces, extension cost per scenario, recommended abstractions
2. **Code-explorer** — end-to-end chain from "click Upgrade" → "see Pro UI", failure mode inventory
3. **Silent-failure-hunter** — swallowed errors, missing red states, log-level audit
4. **General-purpose (frontend)** — green/red state coverage matrix per surface

Cross-references resolved manually. Duplicates folded under the higher-severity finding. Items consistent across 2+ agents weighted up; items reported by 1 agent kept at original severity.
