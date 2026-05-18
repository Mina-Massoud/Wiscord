import type Stripe from 'stripe';
import { User } from '../../db/models/User.js';
import { logger } from '../../lib/logger.js';
import { getStripe } from './stripe-client.js';

/**
 * Stripe → User.billing tier mapping.
 *
 * Status policy notes:
 *
 *   - `past_due` → `pro`. Deliberate grace window: don't lock features
 *     the moment a card fails. Smart Retries (Dashboard → Billing →
 *     Revenue recovery) bounds this — configure the final action to
 *     "Cancel subscription" so the grace doesn't extend indefinitely.
 *
 *   - `unpaid` / `canceled` / `paused` → `free`. The webhook flips
 *     the cached tier here, but `resolveTier` in the AI module ALSO
 *     consults `currentPeriodEnd` so a user who clicked Cancel keeps
 *     Pro until their paid period actually lapses (industry-standard
 *     "Pro until period end" behavior — fewer chargebacks).
 *
 *   - `incomplete` / `incomplete_expired` → `free`. Never successfully
 *     charged.
 */
export const TIER_BY_STATUS: Record<Stripe.Subscription.Status, 'free' | 'pro'> = {
  active: 'pro',
  trialing: 'pro',
  past_due: 'pro',
  unpaid: 'free',
  canceled: 'free',
  incomplete: 'free',
  incomplete_expired: 'free',
  paused: 'free',
};

const SUPPORTED_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
] as const;
type SupportedStatus = (typeof SUPPORTED_STATUSES)[number];

/**
 * Map a raw Stripe status to one of the values our `subscriptionStatus`
 * enum accepts. The intermediate `incomplete*` states collapse to
 * `canceled` — they mean "never successfully charged" so free-tier
 * behavior is correct either way.
 */
export function coerceStatus(raw: Stripe.Subscription.Status): SupportedStatus {
  if ((SUPPORTED_STATUSES as readonly string[]).includes(raw)) return raw as SupportedStatus;
  // incomplete / incomplete_expired both fold to canceled.
  return 'canceled';
}

/**
 * Extract the latest `current_period_end` across a subscription's items.
 * API version 2026-04-22.dahlia moved this field from the Subscription
 * onto each Subscription Item. Single- and multi-item subs both work
 * because we pick the max across items.
 */
function extractCurrentPeriodEnd(sub: Stripe.Subscription): Date | null {
  const periodEndTs = sub.items?.data?.reduce<number>((max, item) => {
    const end = (item as { current_period_end?: number | null }).current_period_end ?? 0;
    return end > max ? end : max;
  }, 0);
  return periodEndTs && periodEndTs > 0 ? new Date(periodEndTs * 1000) : null;
}

export async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const userId = session.metadata?.userId;
  // H4 — split the failure modes by severity. `!userId` is a code
  // bug (we always set metadata.userId in createCheckoutSession), so
  // it should page on-call. `!customerId` is a known Stripe ordering
  // quirk and stays warn-level.
  if (!userId) {
    logger.error(
      { sessionId: session.id, customerId },
      'checkout.session.completed missing userId — metadata not set by createCheckoutSession',
    );
    return;
  }
  if (!customerId) {
    logger.warn(
      { sessionId: session.id, userId },
      'checkout.session.completed missing customer — Stripe ordering race, awaiting retry',
    );
    return;
  }
  // Make sure the user doc references the Stripe customer even if Checkout
  // was kicked off in another tab or before our ensureStripeCustomer ran.
  await User.findByIdAndUpdate(userId, {
    $set: { 'billing.stripeCustomerId': customerId },
  });

  // H1 — back-fill the tier in the same handler. Without this, a
  // `customer.subscription.created` event that lands BEFORE this one
  // can't find the user (their `stripeCustomerId` isn't written yet),
  // logs a warn at line 124, and the tier is silently lost forever.
  // Stripe doesn't guarantee event ordering, so we can't rely on the
  // subscription handler running second.
  //
  // The fetch-then-apply pattern is safe because:
  //   - Webhook idempotency dedup gates retries — this won't double-apply
  //   - `onSubscriptionChanged` is a pure `$set` write — re-running with
  //     the same data is a no-op
  //   - If the subscription event already ran, this write just rewrites
  //     the same values; if it raced and lost, this is the recovery
  if (session.subscription) {
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    try {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      await onSubscriptionChanged(sub);
    } catch (err) {
      // The customer id write above already landed, so a follow-up
      // `customer.subscription.updated` will still find this user.
      // We log error here because falling back to the next subscription
      // event means the user stays on Free until that arrives —
      // potentially minutes. Worth visibility.
      logger.error(
        { err, sessionId: session.id, userId, subscriptionId },
        'checkout.session.completed: failed to back-fill subscription state',
      );
    }
  }
}

export async function onSubscriptionChanged(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const rawStatus = sub.status;
  const status = coerceStatus(rawStatus);
  const tier = TIER_BY_STATUS[rawStatus] ?? 'free';
  // M4 — incomplete / incomplete_expired collapse to `canceled` in
  // our enum, but Stripe can still stamp a future `current_period_end`
  // on them (trial setups, in-flight 3DS confirmations). Honoring that
  // value would mean a never-paid subscription gets the Pro-grace path
  // in `resolveEffectiveTier` (status: 'canceled' + periodEnd in
  // future → 'pro'). Null the field for that family so no grace is
  // ever owed to a never-paid sub.
  const currentPeriodEnd =
    rawStatus === 'incomplete' || rawStatus === 'incomplete_expired'
      ? null
      : extractCurrentPeriodEnd(sub);
  // Capture `cancel_at_period_end` so the UI can render the right
  // copy (and the right Switch state) while a user sits in the
  // post-cancel grace window. Without this, the panel says "Renews
  // on…" for someone who's about to lose access — confusing and
  // bordering on misleading.
  const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;

  const result = await User.findOneAndUpdate(
    { 'billing.stripeCustomerId': customerId },
    {
      $set: {
        'billing.subscriptionId': sub.id,
        'billing.subscriptionStatus': status,
        'billing.subscriptionTier': tier,
        'billing.currentPeriodEnd': currentPeriodEnd,
        'billing.cancelAtPeriodEnd': cancelAtPeriodEnd,
      },
    },
    { new: true, projection: { _id: 1 } },
  ).lean();

  if (!result) {
    // Possible if customer.subscription.updated arrived before
    // checkout.session.completed wrote the customer id — Stripe doesn't
    // guarantee ordering. Subsequent retries (or the next subscription
    // change) will re-converge.
    logger.warn({ customerId }, 'subscription update: no matching user');
  }
}

/**
 * A renewal payment failed. We don't downgrade here — Stripe will fire
 * `customer.subscription.updated` with `past_due` (and our handler will
 * apply that status) once retries begin. This handler exists for ops
 * visibility and to eventually trigger a "your card failed" email.
 *
 * Required event per Stripe's go-live checklist.
 */
export async function onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  logger.warn(
    {
      invoiceId: invoice.id,
      customerId,
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt,
    },
    'stripe: invoice payment failed',
  );
  // TODO(email): when the email service ships, notify the customer
  // their card failed and link them to the billing portal to update.
}

/**
 * EU customers' renewals require SCA (3D Secure). Stripe Checkout
 * handles SCA on initial sign-up; renewals fire this event and we
 * have to email the customer the `hosted_invoice_url` so they can
 * complete authentication. Without this handler, EU users silently
 * fail renewals.
 *
 * Required event for any EU customer.
 */
export async function onInvoicePaymentActionRequired(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  // M8 — elevated from warn → error. Until the email service ships,
  // this handler is a permanent no-op: an EU user whose renewal hits
  // SCA gets nothing, their sub silently drifts to past_due, they
  // lose access without knowing why. Until email is wired, the only
  // recourse is on-call manually emailing them the hosted invoice
  // URL — which means this MUST page someone. The
  // `requiresManualIntervention: true` field is the alert filter.
  logger.error(
    {
      invoiceId: invoice.id,
      customerId,
      hostedUrl: invoice.hosted_invoice_url,
      requiresManualIntervention: true,
    },
    'stripe: invoice requires customer payment action (SCA) — email customer the hosted_invoice_url',
  );
  // TODO(email): email the customer with hosted_invoice_url so they can
  // complete authentication. Without this they'll never know why their
  // sub silently moved to past_due. Once email ships, demote this back
  // to warn since the user will be notified automatically.
}

/**
 * A customer disputed a charge. Revoke access immediately so a bad-
 * faith user can't keep using Pro while we eat the chargeback fee.
 * `onChargeDisputeClosed` restores access if Stripe rules in our favor.
 */
export async function onChargeDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  // M5 — `dispute.charge` arrives as a string id when the webhook
  // endpoint isn't configured for object expansion. The old code
  // silently returned in that case, leaving the user on Pro while
  // we ate the chargeback fee. Resolve the charge explicitly so we
  // ALWAYS find the customer, regardless of Dashboard config.
  const customerId = await resolveDisputeCustomerId(dispute);
  if (!customerId) {
    // Elevated to error — a dispute that can't be resolved is money
    // loss. Either the charge was deleted (very rare) or our key
    // can't read it (permissions misconfigured on restricted key).
    // Either way the user keeps Pro until manual intervention.
    logger.error(
      { disputeId: dispute.id, chargeId: typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id },
      'dispute.created: failed to resolve customer id — manual revocation needed',
    );
    return;
  }
  await downgradeByStripeCustomer(customerId, 'dispute');
  logger.warn(
    { disputeId: dispute.id, customerId, reason: dispute.reason },
    'stripe: dispute opened, user downgraded',
  );
}

/**
 * Pull the customer id off a dispute, fetching the charge from Stripe
 * if the webhook delivered an unexpanded string reference. The
 * Stripe Dashboard's webhook-endpoint settings control whether
 * `dispute.charge` arrives expanded; this helper makes us
 * independent of that toggle.
 */
async function resolveDisputeCustomerId(dispute: Stripe.Dispute): Promise<string | null> {
  if (typeof dispute.charge !== 'string') {
    const customer = dispute.charge?.customer;
    return typeof customer === 'string' ? customer : (customer?.id ?? null);
  }
  try {
    const charge = await getStripe().charges.retrieve(dispute.charge);
    const customer = charge.customer;
    return typeof customer === 'string' ? customer : (customer?.id ?? null);
  } catch (err) {
    logger.error(
      { err, disputeId: dispute.id, chargeId: dispute.charge },
      'dispute.created: charge.retrieve failed',
    );
    return null;
  }
}

/**
 * A dispute closed. If we won, the user paid legitimately and we
 * should re-enable Pro — but rather than guess, log and require a
 * follow-up Stripe subscription event (or manual intervention) to
 * restore. Closed-as-lost is a no-op: access was already revoked
 * when the dispute opened.
 */
export async function onChargeDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
  logger.warn(
    { disputeId: dispute.id, status: dispute.status },
    'stripe: dispute closed — manual review may be needed to restore access if won',
  );
}

/**
 * A charge was refunded. Downgrade the user — they no longer paid for
 * Pro for the period the refund covered. Note: this can also fire from
 * a subscription cancellation refund flow, so the user may already be
 * downgraded by the time this lands.
 */
export async function onChargeRefunded(charge: Stripe.Charge): Promise<void> {
  if (!charge.refunded && charge.amount_refunded < charge.amount) {
    // Partial refund — don't auto-downgrade; could be a billing adjustment.
    logger.info(
      { chargeId: charge.id, refunded: charge.amount_refunded, total: charge.amount },
      'stripe: partial refund — keeping access',
    );
    return;
  }
  const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
  if (!customerId) {
    logger.warn({ chargeId: charge.id }, 'charge.refunded: no customer id available');
    return;
  }
  await downgradeByStripeCustomer(customerId, 'refund');
  logger.warn({ chargeId: charge.id, customerId }, 'stripe: full refund — user downgraded');
}

/**
 * A Stripe customer was deleted (from the Dashboard, or by a cleanup
 * script). Null out our cached id so the user's next checkout creates
 * a fresh customer rather than failing on a dead reference.
 */
export async function onCustomerDeleted(customer: Stripe.Customer): Promise<void> {
  await User.findOneAndUpdate(
    { 'billing.stripeCustomerId': customer.id },
    {
      $unset: { 'billing.stripeCustomerId': '', 'billing.subscriptionId': '' },
      $set: {
        'billing.subscriptionStatus': 'canceled',
        'billing.subscriptionTier': 'free',
        'billing.currentPeriodEnd': null,
        'billing.cancelAtPeriodEnd': false,
      },
    },
  );
  logger.warn({ customerId: customer.id }, 'stripe: customer deleted, user unlinked');
}

/**
 * Shared revocation path for dispute / refund / dispute-loss flows.
 * Looks the user up by stripeCustomerId and flips their tier to free.
 * `currentPeriodEnd` is cleared so `resolveTier`'s grace-window check
 * doesn't keep them on Pro past a dispute opening.
 */
async function downgradeByStripeCustomer(
  customerId: string,
  reason: 'dispute' | 'refund',
): Promise<void> {
  const result = await User.findOneAndUpdate(
    { 'billing.stripeCustomerId': customerId },
    {
      $set: {
        'billing.subscriptionStatus': 'canceled',
        'billing.subscriptionTier': 'free',
        'billing.currentPeriodEnd': null,
        'billing.cancelAtPeriodEnd': false,
      },
    },
    { new: true, projection: { _id: 1 } },
  ).lean();
  if (!result) {
    logger.warn({ customerId, reason }, 'downgrade: no matching user for customer');
  }
}
