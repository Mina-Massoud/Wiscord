import { cn } from '@/lib/cn';

interface SidebarNavButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

/**
 * Action variant of SidebarNavRow for rows that open a dialog instead of
 * navigating (e.g. "Start your own" → the create-server modal). Same row chrome
 * as SidebarNavRow so the two read as siblings.
 */
export function SidebarNavButton({
  label,
  icon,
  onClick,
}: SidebarNavButtonProps): React.JSX.Element {
  return (
    // eslint-disable-next-line react/forbid-elements -- tile-like nav row, not a standard button surface
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-control mx-2 flex h-[42px] items-center gap-3 rounded-md px-2 font-medium transition-colors',
        'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:outline-none',
        'text-ink-muted hover:bg-glass-hover hover:text-ink',
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
    </button>
  );
}
