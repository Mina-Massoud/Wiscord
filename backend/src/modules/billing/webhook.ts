import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import type Stripe from 'stripe';
import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { ProcessedWebhookEvent } from '../../db/models/index.js';
import { getStripe } from './stripe-client.js';
import {
  onChargeDisputeClosed,
  onChargeDisputeCreated,
  onChargeRefunded,
  onCheckoutCompleted,
  onCustomerDeleted,
  onInvoicePaymentActionRequired,
  onInvoicePaymentFailed,
  onSubscriptionChanged,
} from './webhook-handlers.js';

/**
 * Raw-body parser scoped to the webhook path. Must run **before** the
 * global `express.json()` middleware or signature verification will fail
 * because Express will have already consumed and re-serialized the body.
 */
export const stripeWebhookBodyParser = express.raw({ type: 'application/json' });

/** Mongo duplicate-key error code — surfaces when the dedup index on
 *  ProcessedWebhookEvent blocks a re-insert of an event we've already
 *  processed. */
function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}

/**
 * Best-effort idempotency gate. Returns `true` if this is the first time
 * we've seen `event.id`, `false` if it's a duplicate (Stripe retried,
 * or the event was manually replayed from the dashboard).
 *
 * On a duplicate, the caller should return 200 to Stripe without
 * re-running business logic — re-processing today's writes happens to
 * be idempotent ($set on a fixed value), but any future handler that
 * sends an email, increments a credit, or charges a fee would fire
 * twice and corrupt state.
 */
async function claimEventId(event: Stripe.Event): Promise<boolean> {
  try {
    await ProcessedWebhookEvent.create({ eventId: event.id, eventType: event.type });
    return true;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
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

    // Idempotency gate — Stripe delivers events at least once. Drop
    // duplicates before any business logic runs so re-deliveries
    // can't double-credit, double-email, or double-revoke.
    const firstSeen = await claimEventId(event);
    if (!firstSeen) {
      logger.info({ eventId: event.id, type: event.type }, 'stripe webhook: duplicate, skipped');
      res.json({ received: true, duplicate: true });
      return;
    }

    await dispatchEvent(event);
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Route a Stripe event to the matching handler. Unknown event types
 * are logged at debug and acknowledged — Stripe sends many events we
 * don't care about (e.g. `payment_intent.created`), and returning a
 * non-200 would trigger 3 days of retries for events we'll never act
 * on.
 *
 * Adding a new handler: import it from `webhook-handlers.js`, add the
 * case here. Each handler is responsible for its own logging and
 * tolerates an unknown customer (no-op + warn) without throwing.
 */
async function dispatchEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutCompleted(event.data.object);
      return;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await onSubscriptionChanged(event.data.object);
      return;
    case 'invoice.payment_failed':
      await onInvoicePaymentFailed(event.data.object);
      return;
    case 'invoice.payment_action_required':
      await onInvoicePaymentActionRequired(event.data.object);
      return;
    case 'charge.dispute.created':
      await onChargeDisputeCreated(event.data.object);
      return;
    case 'charge.dispute.closed':
      await onChargeDisputeClosed(event.data.object);
      return;
    case 'charge.refunded':
      await onChargeRefunded(event.data.object);
      return;
    case 'customer.deleted':
      await onCustomerDeleted(event.data.object);
      return;
    // invoice.paid is intentionally a no-op — subscription events already
    // carry the renewed currentPeriodEnd, so we don't need to react twice.
    default:
      logger.debug({ type: event.type }, 'stripe webhook: ignored event');
  }
}
