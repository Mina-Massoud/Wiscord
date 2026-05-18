import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

interface RoleStepRoleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

/**
 * Single role card on the onboarding role step. Two siblings sit
 * side-by-side on desktop (student / teacher). Selected state is the
 * blurple ring; non-selected is the standard glass-border edge.
 * Click anywhere on the card selects — the whole tile is the hit
 * target, per the labs-tile pattern in CLAUDE.md.
 */
export function RoleStepRoleCard({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: RoleStepRoleCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'bg-glass-surface-1 ease-wiscord flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all duration-150',
        'hover:bg-glass-surface-2 focus-visible:outline-blurple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        selected ? 'border-blurple ring-blurple/40 ring-2' : 'border-glass-border',
      )}
    >
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-lg',
          selected ? 'bg-blurple/15 text-blurple' : 'bg-glass-surface-2 text-ink-muted',
        )}
        aria-hidden
      >
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-ink text-subhead font-semibold">{title}</span>
        <span className="text-ink-muted text-caption">{description}</span>
      </div>
    </button>
  );
}
