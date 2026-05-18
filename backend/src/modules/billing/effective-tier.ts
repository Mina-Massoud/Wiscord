/**
 * Compute the EFFECTIVE subscription tier for a user, independent of
 * whatever value is currently denormalized on `billing.subscriptionTier`.
 *
 * Why this exists — the "industry-standard grace window":
 *
 * Stripe's recommended UX for subscription cancels is "Pro until the
 * current billing period ends" — a user who paid for the month keeps
 * what they paid for through period end, then drops to Free. Stripe's
 * own Billing Portal defaults to "cancel at period end" because of this.
 *
 * If we naively flipped `subscriptionTier` to `free` the moment the
 * webhook fires for `customer.subscription.deleted`, users would lose
 * Pro access immediately on click — they'd dispute the charge, we'd
 * lose the dispute, and we'd eat a $15 chargeback fee on top of the
 * refund. So the webhook KEEPS the cached tier at `pro` while the
 * status is canceled-but-period-still-active, and this helper handles
 * the lazy flip to free once period_end lapses.
 *
 * Status semantics this honors:
 *   - active / trialing → Pro
 *   - past_due → Pro (Stripe Smart Retries grace window; configure the
 *     retry policy in Dashboard so this can't extend indefinitely)
 *   - canceled with currentPeriodEnd > now → Pro (paid grace)
 *   - canceled with currentPeriodEnd ≤ now → Free
 *   - unpaid / paused / none / anything else → Free
 *
 * The function only reads — it doesn't mutate the cached tier. The
 * webhook layer keeps the denormalized field reasonably up-to-date,
 * and this helper is the safety net that catches the gap where
 * Stripe doesn't fire a fresh event the moment a grace period lapses.
 */

export interface BillingShape {
  subscriptionTier?: 'free' | 'pro' | null;
  subscriptionStatus?:
    | 'none'
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused'
    | null;
  currentPeriodEnd?: Date | string | null;
}

export function resolveEffectiveTier(
  billing: BillingShape | null | undefined,
  now: Date = new Date(),
): 'free' | 'pro' {
  if (!billing) return 'free';
  const status = billing.subscriptionStatus;

  // Active, trialing, or in the grace window after a payment failure.
  if (status === 'active' || status === 'trialing' || status === 'past_due') return 'pro';

  // Canceled but the paid period hasn't elapsed yet → keep Pro.
  if (status === 'canceled') {
    const periodEndDate =
      billing.currentPeriodEnd instanceof Date
        ? billing.currentPeriodEnd
        : billing.currentPeriodEnd
          ? new Date(billing.currentPeriodEnd)
          : null;
    if (periodEndDate && periodEndDate.getTime() > now.getTime()) return 'pro';
  }

  return 'free';
}
