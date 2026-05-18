import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * Idempotency log for Stripe webhook events.
 *
 * Stripe delivers events AT LEAST ONCE — network retries, our own
 * 5xx responses, and manual dashboard replays can all redeliver the
 * same `evt_xxx`. Without a dedup gate, every retry re-runs the
 * handler, which is fine for our current pure-`$set` writes but
 * dangerous for any future handler that increments a credit, sends
 * an email, or grants entitlement.
 *
 * Dedup pattern: at the top of the webhook handler, attempt to
 * `create({ eventId })`. The unique index makes the insert atomic.
 * If it throws E11000 we've seen the event before — return 200 to
 * Stripe and skip the rest of the handler.
 *
 * Retention: 30 days. Stripe's retry window is ~3 days, so 30 days
 * gives us a comfortable margin if a delivery is delayed past the
 * usual horizon (and matches the rolling window Stripe themselves
 * use for their replay tools).
 */

const processedWebhookEventSchema = new Schema(
  {
    /** Stripe's `evt_xxx` id — the event's stable identifier across
     *  retries and dashboard replays. */
    eventId: { type: String, required: true },
    /** Stripe event type (e.g. `customer.subscription.updated`).
     *  Stored for debugging; not used for dedup. */
    eventType: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'processed_webhook_events' },
);

// Unique on the Stripe event id — this is the dedup gate. An attempted
// re-insert throws E11000, which the handler catches and treats as
// "already processed, skip".
processedWebhookEventSchema.index({ eventId: 1 }, { unique: true });

// 30-day TTL — Stripe retries for ~3 days; the extra month is buffer.
processedWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

applySerialize(processedWebhookEventSchema);

export type ProcessedWebhookEventRow = InferSchemaType<typeof processedWebhookEventSchema>;
export type ProcessedWebhookEventDoc = HydratedDocument<ProcessedWebhookEventRow>;
export const ProcessedWebhookEvent = model('ProcessedWebhookEvent', processedWebhookEventSchema);
