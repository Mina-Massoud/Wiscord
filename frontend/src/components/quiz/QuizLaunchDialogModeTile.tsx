import { cn } from '@/lib/cn';

interface ModeTileProps {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}

export function ModeTile({
  selected,
  onSelect,
  icon,
  label,
  description,
}: ModeTileProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'border-glass-border bg-glass-surface-1 hover:border-glass-border-strong text-ink flex items-start gap-3 rounded-md border p-4 text-left transition-colors',
        'focus-visible:ring-blurple focus-visible:ring-offset-canvas focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        selected && 'border-blurple bg-blurple/10 ring-blurple ring-1',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'bg-surface-composer text-ink-muted flex size-9 shrink-0 items-center justify-center rounded-md',
          selected && 'bg-blurple/20 text-blurple',
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-control font-semibold">{label}</span>
        <span className="text-ink-muted text-caption">{description}</span>
      </span>
    </button>
  );
}
