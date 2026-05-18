# Stripe Go-Live Checklist

**Companion to** [`2026-05-18-payments-flow-audit.md`](./2026-05-18-payments-flow-audit.md).

This is the **Dashboard work** that can't live in the codebase. Code-level audit findings (C1–C6, H1–H8, M1–M8) are resolved in commits. Items below are configuration changes you make once, on the Stripe Dashboard, before flipping to live mode.

**Order matters.** Each section depends on the previous ones — don't skip ahead.

---

## 0. Pre-flight: confirm code is on `main`

Before touching the Dashboard, verify:

- [ ] Phase 1–3 audit fixes are merged: webhook idempotency (C3), required env (C4), `invoice.payment_failed` + `invoice.payment_action_required` handlers (C5/C6), atomic customer creation (H1), `currentPeriodEnd` grace window (H5).
- [ ] `backend/tests/billing/*` all pass: `npm test -- tests/billing/`
- [ ] `npm run typecheck` is clean.

If any of these fail, fix them before continuing. The Dashboard work below assumes a code surface that handles the events you're about to enable.

---

## 1. Live-mode Product + Price

The current `STRIPE_PRICE_PRO_MONTHLY` is a **test-mode** Price ID. It will not work in live mode — Stripe enforces a hard separation between test and live objects.

### Steps

1. Stripe Dashboard → top-right toggle → switch to **live mode**.
2. Products → "+ Add product".
   - **Name:** `Wiscord Pro`
   - **Description:** Match the marketing copy on the upgrade page so it appears verbatim on the Stripe-hosted Checkout.
3. Pricing: recurring, $9.00 USD / month.
   - Save the Price ID — it starts with `price_` and is **different from** the test-mode one.
4. Update production env: `STRIPE_PRICE_PRO_MONTHLY=price_xxx`.

### Verification

- [ ] In Stripe Dashboard live mode, the product appears under Products with status "Active".
- [ ] `STRIPE_PRICE_PRO_MONTHLY` in production secret store starts with `price_` (not `price_test_…`).
- [ ] A test charge against a real card on production succeeds and shows "Wiscord Pro" on the customer's bank statement.

---

## 2. Restricted API key (replace `STRIPE_SECRET_KEY`)

Today we use a full-access `sk_live_…` key. If it leaks (committed by accident, sent in a Slack DM, exposed in a heap dump), an attacker can refund every charge, delete every customer, and read every PII field on file. A **restricted key** limits the blast radius to exactly what the backend actually does.

### Steps

1. Dashboard → Developers → API keys → "+ Create restricted key".
2. Name it `wiscord-backend-prod`.
3. Permissions — set EVERYTHING to **None** except:
   - **Customers**: Read + Write
   - **Subscriptions**: Read
   - **Checkout Sessions**: Write
   - **Billing Portal Sessions**: Write
   - **Invoices**: Read
   - **Charges**: Read (for the `charge.dispute.*` and `charge.refunded` event payloads)
4. Save → copy the `rk_live_…` value into the production secret store as `STRIPE_SECRET_KEY`.
5. Roll the old `sk_live_…` key (Dashboard → Developers → API keys → "..." → Roll key). Don't just delete — rolling forces immediate invalidation.

### Verification

- [ ] Production deploys and successfully creates a Checkout session.
- [ ] Production successfully opens a Billing Portal session.
- [ ] Production successfully lists invoices for an existing customer.
- [ ] Attempting `stripe.refunds.create({...})` from a Node REPL with the restricted key throws `permission_error` (this is the test that the key is actually restricted).

---

## 3. Live webhook endpoint (the most common silent-failure)

Webhook endpoints in test mode and live mode are **separate objects** with **separate secrets**. The test endpoint won't receive live events. A common go-live failure: deploy with the test secret in `STRIPE_WEBHOOK_SECRET`, every live event returns 400, after 3 days Stripe gives up retrying, every paying customer's tier upgrade silently disappears. (See audit finding C4.)

### Steps

1. Dashboard (live mode) → Developers → Webhooks → "+ Add endpoint".
2. URL: `https://<your-prod-domain>/billing/webhook`.
3. **Events to send** — select these eight exactly:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`
   - `charge.dispute.created`
   - `charge.dispute.closed`
   - `charge.refunded`
   - `customer.deleted`
4. API version: pin to **`2026-04-22.dahlia`** — matches `stripe-client.ts:21`. Stripe defaults to the account default, which can drift.
5. Click "Add endpoint" → copy the **Signing secret** (`whsec_…`) into prod env as `STRIPE_WEBHOOK_SECRET`.

### Verification

- [ ] Send a test event from Dashboard → endpoint detail page → "Send test webhook" → `checkout.session.completed`. Production returns 200.
- [ ] Server log shows `stripe webhook: ignored event` for any event type NOT in the list above — confirms the route is reachable and the signature is valid (a wrong secret would log `stripe webhook signature failed`).
- [ ] Replay the same test event a second time from the Dashboard. Server log shows `stripe webhook: duplicate, skipped` (confirms C3 idempotency is wired against the live secret).

---

## 4. Smart Retries policy (caps the `past_due → pro` grace)

Per audit H9: our code grants `past_due → pro` as a deliberate grace window so a card failure doesn't lock features the moment it bounces. But Stripe's **default** Smart Retries window can extend up to 2 months — without a configured cap, a permanently-dead card grants 2 months of free Pro.

### Steps

1. Dashboard → Billing → Settings → Revenue recovery.
2. Smart Retries: **Enabled**.
3. Retry schedule: **4 attempts over 21 days**. Recommended distribution:
   - Day 1: 3h after first failure (typical card-on-file glitch resolves fast)
   - Day 3
   - Day 7
   - Day 21
4. **Final action when all retries fail:** "Cancel subscription".
   - Critical: this fires `customer.subscription.deleted`, which our webhook handles correctly (flips status to `canceled`, keeps tier at `pro` until `currentPeriodEnd` lapses per H5 grace logic).
   - If you pick "Mark as uncollectible" instead, the sub goes to `unpaid` indefinitely and our code never downgrades the user. **Don't pick this.**
5. Email notifications: enable "Payment failed" and "Payment retried" so the customer gets a heads-up.

### Verification

- [ ] In Dashboard, the chosen retry schedule reads "4 attempts, final action: Cancel subscription".
- [ ] Force a card failure via Stripe CLI: `stripe trigger invoice.payment_failed`. Server log shows `stripe: invoice payment failed`.
- [ ] After all retries exhaust on a real-world stuck card, `customer.subscription.deleted` fires and the user's `subscriptionStatus` flips to `canceled`. They keep Pro until `currentPeriodEnd` (verified by `tests/billing/effective-tier.test.ts`).

---

## 5. Stripe Tax (mandatory for any EU customer)

EU customers are subject to VAT, which we must collect and remit. Without `automatic_tax`, a single EU customer can trigger a tax-authority audit + back-taxes + penalties. Stripe Tax is the lowest-friction way to handle this correctly.

### Steps

1. Dashboard → Tax → Get started.
2. Stripe Tax onboarding:
   - Origin address: your registered business address.
   - Tax IDs: enter EU VAT IDs if you've registered in any specific EU country, otherwise leave blank and Stripe uses the One-Stop Shop (OSS) treatment.
3. Tax registrations: register in any country where you've crossed the threshold. For Wiscord at launch (zero existing customers), this is "none yet" — Stripe will start the threshold-tracking automatically.
4. **Update `backend/src/modules/billing/service.ts:createCheckoutSession`:**

```ts
const session = await stripe.checkout.sessions.create({
  // ... existing fields ...
  automatic_tax: { enabled: true },
  customer_update: {
    address: 'auto',
    name: 'auto',
  },
});
```

Stripe Checkout will collect the billing address from the customer; `customer_update: 'auto'` is required when `automatic_tax: enabled` so the address gets cached on the Customer for renewals.

### Verification

- [ ] Test checkout from an EU card (`4000 0027 6000 0008` for DE) shows a VAT line item.
- [ ] Test checkout from a US card does NOT show a VAT line (US-state tax handled separately if/when you cross a threshold).
- [ ] Stripe Dashboard → Tax → Reports shows the test charge with the correct rate.

---

## 6. Billing Portal configuration

Stripe's Billing Portal is the customer-facing surface where users update payment methods, cancel subscriptions, and view invoices. The defaults need tweaking.

### Steps

1. Dashboard → Settings → Billing → Customer portal.
2. **Features to enable:**
   - Update payment method ✅
   - Update billing details ✅
   - View invoice history ✅
   - **Cancel subscriptions: ✅, cancellation policy: "Immediately"**
     - Why "Immediately" instead of "End of period": Stripe's "end of period" option keeps `status='active'` and just sets `cancel_at_period_end=true`. Our H5 fix already handles "Pro until period end" via the `canceled + currentPeriodEnd > now` branch — so "Immediately" lets the user flow cleanly cancel + retain grace, while keeping our state machine simple (one canceled status, one grace path).
   - Update subscription plan: ❌ (only one plan today; re-enable when we add an annual tier)
3. **Branding:** upload the Wiscord logo, set brand color, set return URL → `https://<frontend>/settings/billing`.
4. **Terms of service URL** and **privacy policy URL**: required for live mode. Point to whatever pages exist on the marketing site.

### Verification

- [ ] Log into a test account with a Pro subscription on production. Open Portal. Confirm the four enabled features above are present and the rest are absent.
- [ ] Cancel a test sub from the Portal. Webhook fires `customer.subscription.deleted`. User's `subscriptionStatus` becomes `canceled`, but `/ai/ask` still works because `currentPeriodEnd` is in the future (H5).

---

## 7. Email + Receipts

Stripe sends transactional emails (receipts, failed-payment notices, SCA prompts) on our behalf — but only if we enable them and provide a support email.

### Steps

1. Dashboard → Settings → Emails.
2. Enable:
   - Successful payments (receipt) ✅
   - Failed payments ✅
   - Customer-initiated actions ✅ (e.g. they canceled — confirmation email)
3. Set "Customer support email" to a real, monitored inbox.
4. **Until our own email service ships**, the audit's C5 / C6 handlers (`onInvoicePaymentFailed`, `onInvoicePaymentActionRequired`) only log. Stripe's built-in emails fill the gap — they include the `hosted_invoice_url` automatically for SCA flows. Good enough for launch.

### Verification

- [ ] Test a successful charge → customer's email shows the Stripe receipt with Wiscord branding.
- [ ] Test a failed charge (card `4000 0000 0000 0341` declines) → customer's email shows the failed-payment notice.
- [ ] Test an SCA-required card (`4000 0027 6000 3184`) → customer's email shows a link to complete authentication, which uses the same `hosted_invoice_url` our handler logs.

---

## 8. Radar (fraud protection)

Stripe Radar is on by default for live accounts. Verify it's tuned for our risk profile.

### Steps

1. Dashboard → Radar → Rules.
2. Confirm the default rules are enabled:
   - Block if `:risk_score: > 75` ✅
   - Block if `:cvc_check: = 'fail'` ✅
   - 3DS if `:risk_score: > 65` ✅
3. We are NOT enabling Radar for Fraud Teams ($) — the default Radar tier is included free with the standard fee and is sufficient for a $9/mo product.

### Verification

- [ ] In Dashboard → Radar → Test, a known-fraud card (`4100 0000 0000 0019`) is blocked.
- [ ] In Dashboard → Radar → Reviews, no charges sit in "Manual review needed" for more than 24h (these should be rare; if not, tune rules).

---

## 9. Live-mode env vars — final checklist

After all the steps above, the production secret store should hold:

| Variable | Source | Format |
|---|---|---|
| `STRIPE_SECRET_KEY` | Step 2 (restricted key) | `rk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | Step 3 (live endpoint) | `whsec_…` |
| `STRIPE_PRICE_PRO_MONTHLY` | Step 1 (live product) | `price_…` (NOT `price_test_…`) |

The `env.ts` post-parse guard refuses to boot in `NODE_ENV=production` if any of these are missing (audit C4). Verify by:

- [ ] Deploying with `STRIPE_WEBHOOK_SECRET` deliberately unset — boot fails with `[env] missing production-required environment variables` naming the variable.
- [ ] Restore the value, deploy — boot succeeds.

---

## 10. The first real charge

Before announcing the product, run a complete end-to-end transaction against your own card on production:

1. Visit production. Sign up with a fresh email.
2. Hit `/billing/checkout-session` → complete checkout with a real card.
3. Verify in Stripe Dashboard (live mode):
   - Customer was created with `metadata.userId = <your user id>`.
   - Subscription is `active` with `current_period_end` set.
   - Invoice is `paid`.
4. Verify in production Mongo (or via `GET /billing/subscription`):
   - `billing.stripeCustomerId` matches.
   - `billing.subscriptionTier === 'pro'`.
   - `billing.subscriptionStatus === 'active'`.
   - `billing.currentPeriodEnd` is ~30 days out.
5. Hit `/ai/quota` — confirm caps reflect Pro tier.
6. Open Billing Portal → cancel the subscription.
7. Verify the webhook fired:
   - `customer.subscription.deleted` arrived.
   - `subscriptionStatus` is now `canceled`.
   - `currentPeriodEnd` is still set.
   - `/ai/quota` still reports Pro caps (H5 grace window working).
8. Refund the charge from Stripe Dashboard.
   - `charge.refunded` arrives.
   - `subscriptionTier` flips to `free` immediately (audit M5).

If all 8 steps pass, you're done. Announce.

---

## What's deliberately out of scope

- **Annual plan** — adds complexity (proration, plan-change webhooks) we don't need for the first 100 paying customers.
- **Coupons / promo codes** — `allow_promotion_codes: true` is already in `createCheckoutSession`. To issue codes, create them in Dashboard → Products → Coupons. No code change needed.
- **Multi-currency** — Stripe handles per-country presentment automatically when `automatic_tax: enabled`. We don't need to ship multiple `Price` objects.
- **Manual invoicing / quotes** — irrelevant for a $9/mo self-serve product.
- **Tax registration in specific countries** — Stripe Tax tracks thresholds automatically. Register only when you cross one.
