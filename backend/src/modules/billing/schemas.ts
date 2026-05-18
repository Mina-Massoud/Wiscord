/**
 * Subscription state the frontend reads from `GET /billing/subscription`.
 *
 * `status` mirrors the User model enum exactly — adding `unpaid` /
 * `paused` here closes the M3 audit gap where those values could
 * escape through the API as untyped strings. The frontend
 * `SubscriptionStatus` type stays in sync; treat both as terminal-ish
 * (Free tier) but render distinct copy if needed.
 *
 * `tier` is the EFFECTIVE tier (post-`resolveEffectiveTier`) — a user
 * mid-cancel-grace gets `tier: 'pro'` even though their cached
 * `User.billing.subscriptionTier` field reads `'free'`. The status
 * field carries the raw Stripe state so the UI can render the
 * "Pro access ends on …" banner against the cancel state.
 */
export interface SubscriptionResponse {
  status: 'none' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
  tier: 'free' | 'pro';
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
  /**
   * Mirrors Stripe's `subscription.cancel_at_period_end`. `true`
   * means the user has cancelled but the period hasn't elapsed
   * yet — drive the StatusBanner's "Ends on …" copy and the
   * AutoRenewRow toggle's off state from this.
   */
  cancelAtPeriodEnd: boolean;
}

export interface AutoRenewResponse {
  /** Final auto-renew state after the toggle settled. */
  enabled: boolean;
  /** ISO of the period that would expire if auto-renew stays off. */
  currentPeriodEnd: string | null;
}

export interface CheckoutSessionResponse {
  url: string;
}

export interface PortalSessionResponse {
  url: string;
}

export interface InvoiceItem {
  id: string;
  amountPaid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  createdAt: string;
}
