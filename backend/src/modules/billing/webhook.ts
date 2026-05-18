import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import type Stripe from 'stripe';
import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { User } from '../../db/models/User.js';
import { getStripe } from './stripe-client.js';

/**
 * Raw-body parser scoped to the webhook path. Must run **before** the
 * global `express.json()` middleware or signature verification will fail
 * because Express will have already consumed and re-serialized the body.
 */
export const stripeWebhookBodyParser = express.raw({ type: 'application/json' });

const TIER_BY_STATUS: Record<Stripe.Subscription.Status, 'free' | 'pro'> = {
  active: 'pro',
  trialing: 'pro',
  past_due: 'pro',
  unpaid: 'free',
  canceled: 'free',
  incomplete: 'free',
  incomplete_expired: 'free',
  paused: 'free',
};

const SUPPORTED_STATUSES = ['active', 'trialing', 'past_due', 'canceled'] as const;
type SupportedStatus = (typeof SUPPORTED_STATUSES)[number];

function coerceStatus(raw: Stripe.Subscription.Status): SupportedStatus {
  if ((SUPPORTED_STATUSES as readonly string[]).includes(raw)) return raw as SupportedStatus;
  if (raw === 'unpaid' || raw === 'incomplete' || raw === 'incomplete_expired' || raw === 'paused')
    return 'canceled';
  return 'canceled';
}

export async function stripeWebhookHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const signature = req.header('stripe-signature');
    if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
      res.status(400).send('Missing signature');
      return;
    }
    const stripe = getStripe();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      logger.warn({ err }, 'stripe webhook signature failed');
      res.status(400).send('Invalid signature');
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await onCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await onSubscriptionChanged(event.data.object);
        break;
      // invoice.paid is intentionally a no-op — subscription events already
      // carry the renewed currentPeriodEnd, so we don't need to react twice.
      default:
        logger.debug({ type: event.type }, 'stripe webhook: ignored event');
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const userId = session.metadata?.userId;
  if (!customerId || !userId) {
    logger.warn({ session: session.id }, 'checkout.session.completed missing customer/userId');
    return;
  }
  // Make sure the user doc references the Stripe customer even if Checkout
  // was kicked off in another tab or before our ensureStripeCustomer ran.
  await User.findByIdAndUpdate(userId, {
    $set: { 'billing.stripeCustomerId': customerId },
  });
}

async function onSubscriptionChanged(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const status = coerceStatus(sub.status);
  const tier = TIER_BY_STATUS[sub.status] ?? 'free';
  // In API version 2026-04-22.dahlia the `current_period_end` moved from
  // the Subscription onto each Subscription Item. Pick the latest end across
  // items so single- and multi-item subs both work.
  const periodEndTs = sub.items?.data?.reduce<number>((max, item) => {
    const end = (item as { current_period_end?: number | null }).current_period_end ?? 0;
    return end > max ? end : max;
  }, 0);
  const currentPeriodEnd = periodEndTs && periodEndTs > 0 ? new Date(periodEndTs * 1000) : null;

  const result = await User.findOneAndUpdate(
    { 'billing.stripeCustomerId': customerId },
    {
      $set: {
        'billing.subscriptionStatus': status,
        'billing.subscriptionTier': tier,
        'billing.currentPeriodEnd': currentPeriodEnd,
      },
    },
    { new: true, projection: { _id: 1 } },
  ).lean();

  if (!result) {
    logger.warn({ customerId }, 'subscription update: no matching user');
  }
}
