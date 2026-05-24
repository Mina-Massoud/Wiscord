import type { AiUsageKind } from '../../db/models/AiUsageLog.js';

/**
 * Plan registry — the single source of truth for what each tier
 * costs the user, what caps it grants, and which Gemini model
 * variants it gets routed to.
 *
 * Why this lives in `billing/` instead of `ai/`:
 *
 *   Plans are a billing concept. The AI module *consumes* the
 *   per-plan caps and model selection; it doesn't own them. Future
 *   tiers (annual, lifetime, Pro Plus, team) add an entry HERE and
 *   the AI module picks them up without code changes. Without this
 *   indirection, adding a new tier was a 6-file sweep (the H7
 *   audit finding):
 *
 *     - User.ts:36 (enum)
 *     - effective-tier.ts return type
 *     - webhook-handlers.ts TIER_BY_STATUS
 *     - ai/quota.ts QUOTAS
 *     - ai/service.ts model selection
 *     - frontend SubscriptionPanel FEATURE_SWAPS
 *
 *   With this registry it becomes: one entry here + one entry in
 *   the User enum + one effective-tier branch. Annual and Lifetime
 *   drop to "small" effort; Pro Plus drops to "medium".
 *
 * What's INTENTIONALLY still hardcoded outside this file:
 *
 *   - `TIER_BY_STATUS` in webhook-handlers.ts stays a flat map of
 *     Stripe-status → tier because today every tier we ship uses
 *     the same status semantics (subscriptions, not one-time
 *     payments). When Lifetime ships we'll add a `tierFromPriceId`
 *     lookup; until then the constant is correct and clearer.
 *   - Frontend `FEATURE_SWAPS` in `SubscriptionPanel.tsx` —
 *     marketing copy doesn't load-bear on caps, so the duplication
 *     is acceptable until we have >2 tiers to render.
 */

export type PlanId = 'free' | 'pro';

export interface PlanDef {
  id: PlanId;
  /** User-facing plan name. Capitalized for UI use. */
  displayName: string;
  /**
   * Monthly price in USD cents. `0` for Free; `null` for plans
   * that aren't self-serve (enterprise / custom — none today).
   * Frontend formats this for the panel header.
   */
  priceCents: number;
  /**
   * Daily AI usage caps. Keyed by `AiUsageKind` so adding a new
   * kind (e.g. `voice_minutes` later) forces an explicit cap per
   * tier. Frontend renders these as progress bars against live
   * usage from `useAiQuota`, so the user can see how full their
   * bucket is — not just a number floating in space.
   */
  quotas: Record<AiUsageKind, number>;
  /**
   * Pro-only differentiators that aren't expressible as a daily
   * cap. Frontend uses this to populate the "Pro also includes"
   * line under the usage bars. Keep the list short and concrete
   * — vague features ("better AI") read as marketing puff.
   */
  bullets: string[];
  /**
   * Gemini model selection. `strong` is used when a turn needs
   * more reasoning headroom than the default — today that's only
   * the Pro URL-note path. `null` means "fall back to default";
   * use that for tiers that don't get the strong-model upgrade.
   */
  models: {
    /**
     * `null` → use `env.GEMINI_MODEL`. We don't hardcode the
     * default model id because it's the global default; tiers
     * differ on whether they get the *strong* upgrade, not on
     * what the default is.
     */
    strong: string | null;
  };
}

/**
 * Model id used by Pro for the long-context URL-note path. Lives
 * here (not in `provider/stream-personal.ts` where the actual
 * call site is) so plan-driven model selection has one root.
 *
 * Kept aligned with `STRONG_MODEL` re-exported from the provider
 * module — that export remains the binding the streaming code
 * imports, and is wired to this constant via `plans.ts`'s
 * `models.strong`.
 */
const STRONG_MODEL_ID = 'gemini-2.5-flash';

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free',
    displayName: 'Free',
    priceCents: 0,
    // Free caps are tight by design: enough to get a feel for the
    // product, far below cost-per-user economics. See the prior
    // audit's cost analysis for the math.
    quotas: { message: 100, url_note: 1 },
    bullets: ['gemini-2.0-flash for chat', 'short URL notes'],
    models: { strong: null },
  },
  pro: {
    id: 'pro',
    displayName: 'Pro',
    priceCents: 900,
    // Pro caps exist as soft abuse-prevention, not revenue
    // protection. A normal Pro user lands well below them.
    quotas: { message: 500, url_note: 30 },
    bullets: [
      'gemini-2.5-flash on URL notes',
      'long-form note generation',
      'priority during peak load',
    ],
    models: { strong: STRONG_MODEL_ID },
  },
};

/** Daily cap for one (tier, kind) pair. */
export function quotaFor(tier: PlanId, kind: AiUsageKind): number {
  return PLANS[tier].quotas[kind];
}

/**
 * Returns the strong model id when this tier should use it, else
 * `null`. The AI service then decides whether to apply it based on
 * the turn shape (URL-note path triggers it; plain chat doesn't).
 */
export function strongModelFor(tier: PlanId): string | null {
  return PLANS[tier].models.strong;
}
