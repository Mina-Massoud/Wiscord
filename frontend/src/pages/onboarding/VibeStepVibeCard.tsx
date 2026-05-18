import { cn } from '@/lib/cn';

interface VibeStepVibeCardProps {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

/**
 * One vibe card on the onboarding vibe step. Three siblings stack
 * vertically (genz / chill / professional). Click anywhere on the
 * card selects — the entire tile is the hit target. Selected state
 * pushes the blurple ring; the live preview bubble updates from the
 * parent's selected state, not from this card.
 */
export function VibeStepVibeCard({
  label,
  description,
  selected,
  onSelect,
}: VibeStepVibeCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'bg-glass-surface-1 ease-wiscord flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-all duration-150',
        'hover:bg-glass-surface-2 focus-visible:outline-blurple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        selected ? 'border-blurple ring-blurple/40 ring-2' : 'border-glass-border',
      )}
    >
      <span className="text-ink text-control font-semibold">{label}</span>
      <span className="text-ink-muted text-caption">{description}</span>
    </button>
  );
}
