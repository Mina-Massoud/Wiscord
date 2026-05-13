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
 * Glass shell: one rounded slab that floats over the body-level wallpaper.
 * A single backdrop-blur lives on the outer card; inner zones layer translucent
 * fills on top so we never stack blurs (performance + readability).
 *
 * Composition:
 *   - Viewport gutter (`p-24px`) keeps the photo visible around all four edges.
 *   - Outer card owns the blur, hairline border, drop shadow, rounded corners.
 *   - Left zone (server rail + sidebar) shares one chrome tint with a hairline divider.
 *   - Right zone (top bar over main + optional right rail) sits on a canvas tint.
 *   - Each scrollable column owns its own scroll; the shell is the only viewport-height container.
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
    <div className="text-ink flex h-screen w-screen">
      <div
        className={cn(
          'bg-glass-shell border-glass-border flex h-full w-full flex-col overflow-hidden border',
          className,
        )}
      >
        {titleBar}

        <div className="flex min-h-0 flex-1">
          <div className="bg-glass-chrome border-glass-border flex flex-col border-r">
            <div className="flex min-h-0 flex-1">
              <aside
                aria-label="Servers"
                className="w-server-list border-glass-border flex shrink-0 flex-col border-r"
              >
                {serverRail}
              </aside>
              <aside aria-label="Channels" className="w-channel-list flex shrink-0 flex-col">
                {sidebar}
              </aside>
            </div>
            {userPanel}
          </div>

          <div className="bg-glass-canvas flex min-w-0 flex-1 flex-col">
            {topBar}

            <div className="flex min-h-0 flex-1">
              <main className="flex min-w-0 flex-1 flex-col">{main}</main>

              {rightRail ? (
                <aside
                  aria-label="Active now"
                  className="w-now-panel bg-glass-chrome border-glass-border flex shrink-0 flex-col border-l"
                >
                  {rightRail}
                </aside>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
