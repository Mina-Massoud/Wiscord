import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * Per-turn record of an AI call. Drives daily quota enforcement
 * (Free: 30 messages/day, 3 url_notes/day; Pro: 500/day, 30/day)
 * and admin telemetry (per-user cost, conversion signals).
 *
 * Bucketing strategy:
 *   - `date` is a `YYYY-MM-DD` string in UTC. Quota checks query
 *     `count({ userId, date: todayUtc, kind })` — single point lookup,
 *     no time-range math, no per-request timezone gymnastics.
 *   - `kind` discriminates the cost class. `message` = chat or
 *     grounded turn (cheap, 2.0-flash). `url_note` = web-source-
 *     grounded turn that emitted a long createNote tool call
 *     (expensive, 2.5-flash).
 *   - Token columns are best-effort — Gemini surfaces them on the
 *     `done` event's usageMetadata. We persist whatever lands so we
 *     can do real cost analysis later.
 *
 * Retention: rows TTL out after 35 days. Quota only needs today;
 * the extra month is for "X used this week" UX and weekly cohort
 * analysis. Cost telemetry that needs longer history should
 * aggregate into a daily-rollup collection — out of scope here.
 */

export const AI_USAGE_KINDS = ['message', 'url_note'] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];

const aiUsageLogSchema = new Schema(
  {
    userId: { type: String, required: true },
    /** `YYYY-MM-DD` in UTC. The date the turn started — quota windows
     *  align to UTC midnight, which is good enough for v1 and avoids
     *  per-user-timezone forks in the index strategy. If a user is
     *  far enough east that this feels wrong, we revisit. */
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    kind: { type: String, required: true, enum: AI_USAGE_KINDS },
    // Clamped to non-negative. Gemini occasionally returns -1 on
    // MAX_TOKENS-truncated turns; without `min: 0` those negatives
    // would land in the log and corrupt cost reconciliation.
    promptTokens: { type: Number, required: true, default: 0, min: 0 },
    outputTokens: { type: Number, required: true, default: 0, min: 0 },
    /** Model id Gemini reported on this turn (e.g. `gemini-2.0-flash`
     *  or `gemini-2.5-flash`). Lets us compute real $ per user. */
    model: { type: String, required: true },
    /** Free or pro at the time of the call. Frozen onto the row so a
     *  later upgrade doesn't retroactively re-classify old usage when
     *  we run conversion analytics. */
    tier: { type: String, required: true, enum: ['free', 'pro'] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'ai_usage_logs' },
);

// Quota lookup: count({ userId, date, kind }). The compound index
// covers it.
aiUsageLogSchema.index({ userId: 1, date: 1, kind: 1 });

// Retention: 35 days from createdAt. MongoDB sweeps these on its
// own ~60s cadence; quota math reads from the indexed bucket above,
// so a slightly-late sweep doesn't affect correctness.
aiUsageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 35 * 24 * 60 * 60 });

applySerialize(aiUsageLogSchema);

export type AiUsageLogRow = InferSchemaType<typeof aiUsageLogSchema>;
export type AiUsageLogDoc = HydratedDocument<AiUsageLogRow>;
export const AiUsageLog = model('AiUsageLog', aiUsageLogSchema);

/**
 * Today's date in UTC formatted as `YYYY-MM-DD`. Used both at write
 * time (storing the bucket) and at quota-check time (querying the
 * bucket). Exported so the quota module and tests use the same
 * function — drift between the two breaks every counter.
 */
export function utcDateBucket(d: Date = new Date()): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
