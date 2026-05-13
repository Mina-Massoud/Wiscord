import { Users, Inbox, HelpCircle } from 'lucide-react';

interface AppTitleBarProps {
  title: string;
}

/**
 * Full-width app titlebar that sits above the four-column shell.
 * Centered title (icon + label) with passive inbox / help affordances on the far right.
 */
export function AppTitleBar({ title }: AppTitleBarProps): React.JSX.Element {
  return (
    <header className="bg-surface-chrome h-app-titlebar text-ink-muted relative flex shrink-0 items-center justify-center px-3">
      <div className="text-ink flex items-center gap-1.5">
        <Users className="size-4" />
        <span className="text-control font-medium">{title}</span>
      </div>

      <div className="absolute right-3 flex items-center gap-3">
        <button
          type="button"
          aria-label="Open inbox"
          className="hover:text-ink"
          onClick={(e) => e.preventDefault()}
        >
          <Inbox className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Help"
          className="hover:text-ink"
          onClick={(e) => e.preventDefault()}
        >
          <HelpCircle className="size-4" />
        </button>
      </div>
    </header>
  );
}
