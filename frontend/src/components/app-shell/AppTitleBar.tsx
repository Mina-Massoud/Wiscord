import { Users, Inbox, HelpCircle } from 'lucide-react';

interface AppTitleBarProps {
  title: string;
}

/**
 * Full-width app titlebar above the four-column shell.
 *
 * The Dynamic Island is *not* mounted here — it lives at the document
 * root via a portal so it can grow past the shell's `overflow-hidden`
 * boundary into a full-screen expanded view. The titlebar stays
 * minimal: centered page label + far-right inbox/help affordances.
 */
export function AppTitleBar({ title }: AppTitleBarProps): React.JSX.Element {
  return (
    <header className="border-glass-border h-app-titlebar text-ink-muted relative flex shrink-0 items-center justify-center border-b px-3">
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
