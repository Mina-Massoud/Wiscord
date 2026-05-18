import { AiUsageLog, User } from '../../db/models/index.js';

/**
 * Aggregated metrics for the founder-facing billing dashboard.
 * Pure: no Stripe API calls (Stripe's data lives in their dashboard
 * for the rare detailed lookup; this view is for "is the model
 * working?" not "did this user pay?").
 */
export interface BillingMetrics {
  /** Total signed-up users. */
  totalUsers: number;
  /** Users on the Pro tier RIGHT NOW (subscriptionTier === 'pro'). */
  proUsers: number;
  /** Free users with at least one AI turn in the last 30 days —
   *  the realistic conversion pool (sign-ups that never used the
   *  product shouldn't drag the conversion ratio down). */
  activeFreeUsers: number;
  /** Pro count / (pro + activeFree). Expressed as a fraction 0..1. */
  conversionRate: number;
  /** Pro count × $9 (the monthly price). Doesn't account for annual
   *  discounts since we haven't shipped them yet. Stripe is the
   *  source of truth for actual revenue. */
  estimatedMrrUsd: number;
  /**
   * Real Gemini cost in the last 30 days, computed from logged
   * promptTokens + outputTokens × per-model rates. Includes both
   * tiers — useful for "are free users burning more than expected".
   */
  cost30dUsd: {
    total: number;
    byTier: { free: number; pro: number };
  };
  /**
   * Daily-cap hit telemetry. Counts distinct (userId, date) pairs
   * where the user's usage on that day matched the free-tier cap
   * exactly — proxy for "tried to do more, got blocked". Looks at
   * last 7 days only because broad cap-hit signal decays fast.
   */
  capHits7d: {
    message: number;
    url_note: number;
  };
}

/** Gemini API rates as of build time. Hardcoded because they
 *  rarely change AND we want stable historical cost comparisons
 *  across the dashboard. When rates move, bump these and accept
 *  that the 30d window will smear across the transition. */
const COST_PER_MILLION = {
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
} as const;

function rateFor(model: string): { input: number; output: number } {
  if (model in COST_PER_MILLION) {
    return COST_PER_MILLION[model as keyof typeof COST_PER_MILLION];
  }
  // Unknown model — assume 2.5-flash rates so we don't under-report.
  return COST_PER_MILLION['gemini-2.5-flash'];
}

const PRO_PRICE_USD = 9;

/**
 * Free-tier caps duplicated here so the metric stays accurate even
 * if `QUOTAS` changes; cap-hit telemetry is about THIS quota, not
 * a rolling one. Bump together with `quota.ts` when the limit
 * actually changes.
 */
const FREE_CAPS_FOR_METRICS = {
  message: 30,
  url_note: 3,
} as const;

export async function computeBillingMetrics(): Promise<BillingMetrics> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, proUsers, activeFreeUserRows, costRows, capHitsMessage, capHitsUrl] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ 'billing.subscriptionTier': 'pro' }),
      // Distinct free-tier userIds with AI usage in the last 30d.
      AiUsageLog.aggregate<{ _id: string }>([
        { $match: { tier: 'free', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$userId' } },
      ]),
      // Per-tier × per-model token totals, last 30d.
      AiUsageLog.aggregate<{
        _id: { tier: 'free' | 'pro'; model: string };
        promptTokens: number;
        outputTokens: number;
      }>([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { tier: '$tier', model: '$model' },
            promptTokens: { $sum: '$promptTokens' },
            outputTokens: { $sum: '$outputTokens' },
          },
        },
      ]),
      // Cap-hit count: distinct (userId, date) bucket pairs where
      // the user reached the free-tier `message` cap on that day.
      AiUsageLog.aggregate<{ _id: { userId: string; date: string }; count: number }>([
        { $match: { tier: 'free', kind: 'message', createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { userId: '$userId', date: '$date' }, count: { $sum: 1 } } },
        { $match: { count: { $gte: FREE_CAPS_FOR_METRICS.message } } },
      ]),
      AiUsageLog.aggregate<{ _id: { userId: string; date: string }; count: number }>([
        { $match: { tier: 'free', kind: 'url_note', createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { userId: '$userId', date: '$date' }, count: { $sum: 1 } } },
        { $match: { count: { $gte: FREE_CAPS_FOR_METRICS.url_note } } },
      ]),
    ]);

  const activeFreeUsers = activeFreeUserRows.length;
  const denom = proUsers + activeFreeUsers;
  const conversionRate = denom === 0 ? 0 : proUsers / denom;

  let costFree = 0;
  let costPro = 0;
  for (const row of costRows) {
    const rate = rateFor(row._id.model);
    const tokenCost = (row.promptTokens * rate.input + row.outputTokens * rate.output) / 1_000_000;
    if (row._id.tier === 'pro') costPro += tokenCost;
    else costFree += tokenCost;
  }

  return {
    totalUsers,
    proUsers,
    activeFreeUsers,
    conversionRate,
    estimatedMrrUsd: proUsers * PRO_PRICE_USD,
    cost30dUsd: {
      total: round4(costFree + costPro),
      byTier: { free: round4(costFree), pro: round4(costPro) },
    },
    capHits7d: {
      message: capHitsMessage.length,
      url_note: capHitsUrl.length,
    },
  };
}

/** Cents-level precision for currency display in the admin dashboard. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
