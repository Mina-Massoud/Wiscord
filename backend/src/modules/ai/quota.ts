import { AiUsageCounter, utcDateBucket, type AiUsageKind } from '../../db/models/index.js';
import { AppError } from '../../lib/errors.js';
import { PLANS, type PlanId } from '../billing/plans.js';

import { extractUrls } from './url-fetcher.js';

/**
 * Tier-keyed daily quotas for the personal AI scope.
 *
 *   - `message`  = any chat / grounded turn that did NOT summarize a URL.
 *     Cheap (gemini-2.0-flash, ~$0.0003/turn). Caps are generous.
 *   - `url_note` = a turn that fetched a URL and emitted a long
 *     createNote (gemini-2.5-flash long-note path, ~$0.013/turn).
 *     This is the wedge feature — strict on free, looser on pro.
 *
 * H7 — the cap numbers live in `billing/plans.ts` (the PLANS
 * registry) so adding a new tier touches one file. The `QUOTAS`
 * export here is a thin re-projection over the registry, kept for
 * backwards compatibility with existing callers (admin metrics,
 * tests). New code should call `quotaFor(tier, kind)` directly.
 */
export const QUOTAS: Record<PlanId, Record<AiUsageKind, number>> = {
  free: PLANS.free.quotas,
  pro: PLANS.pro.quotas,
};

/** Snapshot of a single quota bucket for one user. */
export interface QuotaStatus {
  kind: AiUsageKind;
  limit: number;
  used: number;
  remaining: number;
  /** UTC instant when this counter resets (next UTC midnight). The
   *  frontend renders this as a relative countdown. */
  resetAt: string;
}

/**
 * Compute the next UTC-midnight Date — the moment when today's date
 * bucket rolls over and a quota refreshes. Returned as ISO string so
 * the SSE payload stays JSON-serializable.
 */
function nextUtcMidnightIso(now: Date = new Date()): string {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return next.toISOString();
}

/**
 * Classify a request's quota kind from the user's question — done
 * BEFORE the AI runs so we can reject with 402 without burning a
 * Gemini call. URL presence is the only signal we have at this
 * point; if the user typed a link, we assume they want a URL note.
 *
 * Caveat: a Pro user might paste a URL just to ask "what does this
 * say?" and expect a short reply, but they'll get the URL note
 * path either way. That's a UX tradeoff worth the simplicity —
 * pre-flight classification has to use only inputs the user typed.
 */
export function classifyRequestKind(question: string): AiUsageKind {
  return extractUrls(question).length > 0 ? 'url_note' : 'message';
}

/**
 * Read the current usage counters for one user. Returns a status
 * row per quota kind so the frontend can render both "X messages
 * left today" and "Y URL notes left today" without a second call.
 *
 * Reads from AiUsageCounter — the same row that `assertWithinQuota`
 * increments. No drift between gate and display.
 */
export async function getQuotaStatus(args: {
  userId: string;
  tier: 'free' | 'pro';
  /** Override today's bucket (used when a caller already computed it
   *  to avoid a double-call to `new Date()` straddling UTC midnight). */
  today?: string;
}): Promise<QuotaStatus[]> {
  const today = args.today ?? utcDateBucket();
  const rows = await AiUsageCounter.find({ userId: args.userId, date: today }).lean();
  const usedByKind = new Map<AiUsageKind, number>();
  for (const row of rows) usedByKind.set(row.kind as AiUsageKind, row.count);

  const resetAt = nextUtcMidnightIso();
  const limits = QUOTAS[args.tier];
  return (Object.keys(limits) as AiUsageKind[]).map((kind) => {
    const used = usedByKind.get(kind) ?? 0;
    const limit = limits[kind];
    return {
      kind,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      resetAt,
    };
  });
}

/** MongoDB E11000 duplicate-key error — surfaces here when the unique
 *  compound index on AiUsageCounter blocks an upsert because the
 *  counter is already at its limit. */
function isMongoDuplicateKey(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}

function quotaExceededError(args: {
  kind: AiUsageKind;
  tier: 'free' | 'pro';
  limit: number;
}): AppError {
  return new AppError(402, 'quota_exceeded', `daily ${args.kind} quota reached`, {
    kind: args.kind,
    tier: args.tier,
    limit: args.limit,
    used: args.limit,
    resetAt: nextUtcMidnightIso(),
  });
}

/**
 * Atomically reserve one slot from the caller's daily quota. Throws
 * `AppError(402)` when the daily allowance for the given kind is gone.
 *
 * Why this is atomic — and the old `countDocuments`-then-`create`
 * pattern was not:
 *
 *   `findOneAndUpdate({…, count: {$lt: limit}}, {$inc: {count: 1}},
 *     {upsert: true, new: true})` serializes through MongoDB. Two
 *   concurrent calls cannot both pass the filter and both increment
 *   because Mongo applies the writes one at a time per (userId, date,
 *   kind) key.
 *
 * Three outcomes:
 *   - Counter row doesn't exist → upsert creates it with count = 1.
 *   - Counter exists with count < limit → filter matches, count++.
 *   - Counter exists with count ≥ limit → filter doesn't match, upsert
 *     attempts to insert a new doc, the unique compound index on
 *     (userId, date, kind) throws E11000. We translate to 402.
 *
 * The reservation is permanent for the day. A stream that errors out
 * after reservation still costs the user a slot — that's deliberate.
 * Gemini already charged us for the work; an attacker who aborts the
 * SSE connection mid-stream to dodge accounting would otherwise have
 * unlimited free spend at our expense.
 */
export async function assertWithinQuota(args: {
  userId: string;
  tier: 'free' | 'pro';
  kind: AiUsageKind;
  /** Override today's bucket — useful when the route layer wants the
   *  reservation and the eventual `recordUsage` write to share a
   *  single date string instead of each computing their own (which
   *  would drift across UTC midnight). */
  today?: string;
}): Promise<void> {
  const today = args.today ?? utcDateBucket();
  const limit = QUOTAS[args.tier][args.kind];
  try {
    const result = await AiUsageCounter.findOneAndUpdate(
      { userId: args.userId, date: today, kind: args.kind, count: { $lt: limit } },
      { $inc: { count: 1 } },
      { upsert: true, new: true },
    );
    if (!result) {
      // findOneAndUpdate with upsert: true normally always returns a
      // doc. Treating null defensively as "limit reached" keeps the
      // gate correct if Mongo's behavior ever shifts.
      throw quotaExceededError({ kind: args.kind, tier: args.tier, limit });
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isMongoDuplicateKey(err)) {
      throw quotaExceededError({ kind: args.kind, tier: args.tier, limit });
    }
    throw err;
  }
}
