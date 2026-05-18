import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';
import { AI_USAGE_KINDS } from './AiUsageLog.js';

/**
 * Atomic daily quota counter — the gatekeeper for AI usage caps.
 *
 * Why this exists alongside AiUsageLog:
 *
 *   - AiUsageLog is the billing log: append-only rows with token
 *     counts, model id, and tier-at-write-time. Two writers can race-
 *     create rows without conflict, which is fine for accounting but
 *     useless as a cap: a read-then-write `countDocuments` + `create`
 *     pattern lets parallel requests slip past the gate before any of
 *     them write.
 *
 *   - AiUsageCounter is the lock. One row per (userId, date, kind),
 *     compound unique index, mutated with `$inc`. Mongo serializes
 *     the writes, so the cap holds even when ten requests arrive at
 *     once. The reservation cost is one indexed `findOneAndUpdate`.
 *
 * Cap enforcement uses the upsert+filter trick described in
 * `quota.ts:assertWithinQuota`: when count is at the limit the filter
 * doesn't match, the upsert tries to insert a new doc, the unique
 * compound index throws E11000, and we translate that to a 402.
 *
 * Retention: 35 days from createdAt. The counter is only consulted
 * for today; older rows are kept briefly for audit then swept by TTL.
 */

const aiUsageCounterSchema = new Schema(
  {
    userId: { type: String, required: true },
    /** `YYYY-MM-DD` in UTC. Mirrors AiUsageLog.date so the two
     *  collections share the same time-bucket semantics. */
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    kind: { type: String, required: true, enum: AI_USAGE_KINDS },
    count: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: true }, collection: 'ai_usage_counters' },
);

// Unique compound — both the atomicity guarantee and the lookup index.
aiUsageCounterSchema.index({ userId: 1, date: 1, kind: 1 }, { unique: true });

// 35-day TTL — matches AiUsageLog so the two collections retain the
// same window. Older counters aren't useful: quota is "today only".
aiUsageCounterSchema.index({ createdAt: 1 }, { expireAfterSeconds: 35 * 24 * 60 * 60 });

applySerialize(aiUsageCounterSchema);

export type AiUsageCounterRow = InferSchemaType<typeof aiUsageCounterSchema>;
export type AiUsageCounterDoc = HydratedDocument<AiUsageCounterRow>;
export const AiUsageCounter = model('AiUsageCounter', aiUsageCounterSchema);
