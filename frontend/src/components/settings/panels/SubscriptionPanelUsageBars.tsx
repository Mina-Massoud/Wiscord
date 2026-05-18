import { FileText, MessageCircle } from 'lucide-react';

import { useAiQuota } from '@/queries/ai';
import { usePlans, type PlanView } from '@/queries/billing';

import { SubscriptionPanelUsageRow } from './SubscriptionPanelUsageRow';

/**
 * The stack of live usage rows in the subscription panel — the
 * load-bearing change from the old "30/day → no cap" arrow rows
 * the user reported as "feels unlimited."
 *
 * For the caller's current tier, each row shows TODAY's actual
 * count filling a bar against the cap. The Pro cap appears under
 * each bar as a "Pro: 500/day" helper line, making the upgrade's
 * concrete benefit one glance away from the felt limit.
 *
 * Surfaces only the caps we actually enforce server-side
 * (`message`, `url_note`). The old `voice rooms: 30 min` row is
 * dropped because there's no backend enforcement for that limit
 * — fabricated caps are exactly what got us into this redesign.
 *
 * Pro users get the same bars but no helper line — they already
 * have the upgrade, so "Pro: …" would read as redundant copy.
 */
interface UsageBarsProps {
  isPro: boolean;
}

export function SubscriptionPanelUsageBars({ isPro }: UsageBarsProps): React.JSX.Element {
  const { data: quotaData } = useAiQuota();
  const { data: plans } = usePlans();

  // Pull the row matching this user's tier — the live usage. Pro
  // helper text always comes from the Pro plan, regardless of who
  // the caller is, so the value-prop copy stays consistent.
  const usedByKind = new Map(
    (quotaData?.quotas ?? []).map((q) => [q.kind, { used: q.used, resetAt: q.resetAt }]),
  );
  const callerPlan: PlanView | undefined = isPro ? plans?.pro : plans?.free;
  const proPlan: PlanView | undefined = plans?.pro;

  // Two rows — the two caps we actually enforce. Order matches the
  // user's likely upgrade-trigger order: messages get hit first
  // under normal use; url_notes are the wedge feature.
  return (
    <div className="bg-surface-1 divide-y divide-white/5 overflow-hidden rounded-md border border-white/5">
      <SubscriptionPanelUsageRow
        icon={MessageCircle}
        label="messages"
        used={usedByKind.get('message')?.used ?? null}
        cap={callerPlan?.quotas.message ?? 0}
        proCapText={isPro ? null : formatDailyCap(proPlan?.quotas.message)}
        resetAt={usedByKind.get('message')?.resetAt ?? null}
      />
      <SubscriptionPanelUsageRow
        icon={FileText}
        label="url notes"
        used={usedByKind.get('url_note')?.used ?? null}
        cap={callerPlan?.quotas.url_note ?? 0}
        proCapText={isPro ? null : formatDailyCap(proPlan?.quotas.url_note)}
        resetAt={usedByKind.get('url_note')?.resetAt ?? null}
      />
    </div>
  );
}

/**
 * Format a daily cap for the helper line under each bar.
 * Undefined → empty (we just don't render the helper); large
 * numbers get a "X/day" suffix. If we ever ship a tier with an
 * uncapped quota (`Number.POSITIVE_INFINITY`), render "unlimited".
 */
function formatDailyCap(cap: number | undefined): string {
  if (cap === undefined) return '';
  if (!Number.isFinite(cap)) return 'unlimited';
  return `${cap}/day`;
}
