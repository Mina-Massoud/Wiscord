import { cn } from '@/lib/cn';
import type { IslandIdleWidget } from './useIslandPreferences';

interface IdleWidgetRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: IslandIdleWidget;
  current: IslandIdleWidget;
  onSelect: (value: IslandIdleWidget) => void;
}

export function IdleWidgetRow({
  icon,
  title,
  description,
  value,
  current,
  onSelect,
}: IdleWidgetRowProps): React.JSX.Element {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
        active ? 'bg-blurple/15' : 'hover:bg-white/5',
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          active ? 'bg-blurple/20' : 'bg-white/5',
        )}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink text-tab font-medium">{title}</span>
        <span className="text-ink-muted text-caption">{description}</span>
      </div>
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full transition-colors',
          active ? 'bg-blurple' : 'bg-transparent',
        )}
      />
    </button>
  );
}
