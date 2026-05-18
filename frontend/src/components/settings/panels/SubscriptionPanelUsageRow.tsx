import type { ComponentType } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * One usage row in the subscription panel — what the audit calls
 * the "usage-bar-as-cap" pattern. Replaces the old free→pro arrow
 * compare row which the user reported "feels unlimited."
 *
 * Layout (per the Mobbin reference set: Glide, Dub, Apollo, Base44):
 *   [icon] label                              N / cap today
 *          ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 50%
 *          Pro: 500/day
 *
 * The progress bar is load-bearing: a half-filled bar can't be
 * misread as "unlimited" the way a bare "30/day" number can. The
 * Pro helper line under the bar is the visible value-prop —
 * "what you'd unlock" sitting one glance away from "what you have."
 *
 * State variants:
 *   - normal: blurple fill on the bar
 *   - at-zero: destructive fill + helper becomes the reset countdown
 *   - pro user: no helper line (they already have the upgrade)
 *   - loading: skeleton in place of the count + bar
 */
interface UsageRowProps {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  used: number | null;
  cap: number;
  /** `null` when this is the Pro user's row — suppresses the helper. */
  proCapText: string | null;
  /** ISO datetime of the next reset. Used when at zero remaining. */
  resetAt: string | null;
  /** Format the count + cap for the right-hand label. Defaults to `N / cap`. */
  formatCount?: (used: number, cap: number) => string;
}

export function SubscriptionPanelUsageRow({
  icon: Icon,
  label,
  used,
  cap,
  proCapText,
  resetAt,
  formatCount,
}: UsageRowProps): React.JSX.Element {
  // Loading state — used = null means useAiQuota hasn't returned yet.
  // Show the row shape but skeleton the dynamic parts so the layout
  // doesn't shift when data arrives.
  if (used === null) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="text-control flex items-center gap-3">
          <Icon className="text-ink-muted size-4 shrink-0" aria-hidden />
          <span className="text-ink flex-1 normal-case">{label}</span>
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        {proCapText !== null ? <Skeleton className="h-3 w-24" /> : null}
      </div>
    );
  }

  const exhausted = used >= cap;
  const percent = Math.min(100, Math.max(0, Math.round((used / cap) * 100)));
  const countLabel = formatCount ? formatCount(used, cap) : `${used} / ${cap} today`;

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="text-control flex items-center gap-3">
        <Icon
          className={
            exhausted ? 'text-destructive size-4 shrink-0' : 'text-ink-muted size-4 shrink-0'
          }
          aria-hidden
        />
        <span className="text-ink flex-1 normal-case">{label}</span>
        <span
          className={`text-control tabular-nums ${
            exhausted ? 'text-destructive font-semibold' : 'text-ink-muted'
          }`}
        >
          {countLabel}
        </span>
      </div>

      <div
        className="bg-surface-2 relative h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`absolute inset-y-0 left-0 ${
            exhausted ? 'bg-destructive' : 'bg-blurple'
          } duration-base transition-[width]`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {proCapText !== null ? (
        <p className="text-ink-subtle text-caption normal-case">
          {exhausted && resetAt ? (
            <>
              <span className="text-destructive">resets {formatResetCopy(resetAt)}</span>
              <span className="text-ink-subtle"> · Pro: {proCapText}</span>
            </>
          ) : (
            <>Pro: {proCapText}</>
          )}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Short "resets <when>" phrase. Quotas refresh on UTC midnight; we
 * keep the copy fuzzy ("tomorrow", "in 4h") because a precise
 * countdown ratchets anxiety without giving the user anything
 * actionable. Same algorithm as `AiQuotaHint.formatResetCopy` so
 * the two surfaces speak the same way.
 */
function formatResetCopy(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'soon';
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return 'within the hour';
  if (hours < 6) return `in ${Math.round(hours)}h`;
  return 'tomorrow';
}
