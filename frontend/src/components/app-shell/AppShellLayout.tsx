import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface AppShellLayoutProps {
  /** Optional full-width titlebar that sits above every column. */
  titleBar?: ReactNode;
  serverRail: ReactNode;
  sidebar: ReactNode;
  /**
   * Floating panel pinned to the bottom of the left zone. Spans the
   * full width of `serverRail` + `sidebar` so identity/voice controls feel
   * unified across both rails (matches Discord's bottom-left pill).
   */
  userPanel?: ReactNode;
  /** Optional top bar that spans `main` + `rightRail` (e.g. friends tab strip). */
  topBar?: ReactNode;
  main: ReactNode;
  rightRail?: ReactNode;
  className?: string;
}

/**
 * Two-zone shell:
 *  - Left zone (server rail + sidebar share one chrome surface, with an
 *    optional floating `userPanel` pinned at the bottom that spans both).
 *  - Right zone (optional `topBar` over `main` + optional `rightRail`).
 *  - Optional full-width `titleBar` above both zones.
 * Each scrollable column owns its own scroll; the shell is the only viewport-height container.
 */
export function AppShellLayout({
  titleBar,
  serverRail,
  sidebar,
  userPanel,
  topBar,
  main,
  rightRail,
  className,
}: AppShellLayoutProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'bg-canvas text-ink flex h-screen w-screen flex-col overflow-hidden',
        className,
      )}
    >
      {titleBar}

      <div className="flex min-h-0 flex-1">
        <div className="bg-surface-chrome border-t-border-strong flex flex-col rounded-l-md border-t">
          <div className="flex min-h-0 flex-1">
            <aside aria-label="Servers" className="w-server-list flex shrink-0 flex-col border-r">
              {serverRail}
            </aside>
            <aside aria-label="Channels" className="w-channel-list flex shrink-0 flex-col">
              {sidebar}
            </aside>
          </div>
          {userPanel}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {topBar}

          <div className="flex min-h-0 flex-1">
            <main className="bg-canvas flex min-w-0 flex-1 flex-col">{main}</main>

            {rightRail ? (
              <aside
                aria-label="Active now"
                className="w-now-panel bg-canvas border-l-border flex shrink-0 flex-col border-l"
              >
                {rightRail}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
