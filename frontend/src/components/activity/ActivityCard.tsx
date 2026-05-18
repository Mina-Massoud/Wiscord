import { cn } from '@/lib/cn';
import type { ActivityDefinition } from './ActivityRegistry';

interface ActivityCardProps {
  activity: ActivityDefinition;
  onSelect: (activity: ActivityDefinition) => void;
}

/**
 * Single tile in the launcher grid. Composition:
 *
 *  ┌─────────────────────────┐
 *  │  cover                  │  4:3 aspect, gradient + big glyph
 *  │       ┌──────┐          │
 *  │       │ icon │          │
 *  │       └──────┘          │
 *  ├─────────────────────────┤
 *  │ Icon  Title             │  metadata strip: literal icon + title
 *  │       Blurb (1 line)    │  one-line truncated blurb under
 *  └─────────────────────────┘
 *
 * Visual rules locked in frontend-design + CLAUDE.md:
 *  - bg-glass-surface-1 + glass-border, no shadow lift on hover
 *  - cover gradient is registry-owned (each activity = its own hue)
 *  - hover shifts hue ~8° — subtle signature beat, not a "wow"
 *  - the focus ring is the only blurple on this surface (one accent per surface)
 *  - icon in the metadata strip is the activity's literal icon — no magic glyphs
 *  - `coming-soon` activities render dimmed with a corner badge and a non-
 *    interactive button; click is a no-op so the picker stays honest
 */
export function ActivityCard({ activity, onSelect }: ActivityCardProps): React.JSX.Element {
  const Icon = activity.icon;
  const Glyph = activity.cover.glyph;
  const isComingSoon = activity.status === 'coming-soon';

  return (
    <button
      type="button"
      onClick={() => {
        if (isComingSoon) return;
        onSelect(activity);
      }}
      disabled={isComingSoon}
      className={cn(
        'group bg-glass-surface-1 border-glass-border ease-wiscord duration-fast focus-visible:ring-blurple focus-visible:ring-offset-glass-surface-2 relative flex flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        isComingSoon
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-glass-border-strong active:scale-[0.98]',
      )}
      aria-label={isComingSoon ? `${activity.title} (coming soon)` : `Start ${activity.title}`}
      aria-disabled={isComingSoon || undefined}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden" aria-hidden>
        <div
          className={cn(
            'ease-wiscord duration-base absolute inset-0',
            !isComingSoon && 'group-hover:[filter:hue-rotate(8deg)]',
          )}
          style={{ backgroundImage: activity.cover.gradient }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Glyph className="text-ink size-12 opacity-90" strokeWidth={1.25} />
        </div>
        {isComingSoon ? (
          <span className="bg-glass-surface-2 text-ink-muted text-badge border-glass-border absolute top-2 right-2 rounded-full border px-2 py-0.5 font-semibold tracking-[0.08em] uppercase">
            Soon
          </span>
        ) : null}
      </div>
      <div className="border-glass-border flex items-start gap-2 border-t px-3 py-2.5">
        <Icon className="text-ink-muted mt-px size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-ink text-tab truncate font-semibold">{activity.title}</p>
          <p className="text-ink-muted text-caption line-clamp-1">{activity.blurb}</p>
        </div>
      </div>
    </button>
  );
}
