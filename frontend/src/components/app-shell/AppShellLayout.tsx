import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/cn';

const RIGHT_RAIL_DEFAULT_WIDTH_PX = 280; // matches the `now-panel` token in tailwind.config.ts
const RIGHT_RAIL_MIN_WIDTH_PX = 220;
const RIGHT_RAIL_MAX_WIDTH_PX = 480;
const RIGHT_RAIL_KEYBOARD_STEP_PX = 16;

const clampRailWidth = (n: number): number =>
  Math.min(RIGHT_RAIL_MAX_WIDTH_PX, Math.max(RIGHT_RAIL_MIN_WIDTH_PX, n));

interface AppShellLayoutProps {
  /** Optional full-width titlebar that sits above every column. */
  titleBar?: ReactNode;
  serverRail: ReactNode;
  /** Channel/feature sidebar. Omit for surfaces that don't need one (e.g. the whiteboard, where the canvas fills the entire main pane). */
  sidebar?: ReactNode;
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

const RIGHT_RAIL_COLLAPSED_KEY = 'wiscord.shell.rightRailCollapsed';
const RIGHT_RAIL_WIDTH_KEY = 'wiscord.shell.rightRailWidth';

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
 *
 * If a `rightRail` is provided, a collapse toggle appears at the top-right of
 * `main`. Collapse state is persisted to localStorage so the choice survives
 * reloads. Default: expanded.
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
  const [rightRailCollapsed, setRightRailCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(RIGHT_RAIL_COLLAPSED_KEY) === '1';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RIGHT_RAIL_COLLAPSED_KEY, rightRailCollapsed ? '1' : '0');
  }, [rightRailCollapsed]);

  const [rightRailWidth, setRightRailWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return RIGHT_RAIL_DEFAULT_WIDTH_PX;
    const stored = window.localStorage.getItem(RIGHT_RAIL_WIDTH_KEY);
    if (stored === null) return RIGHT_RAIL_DEFAULT_WIDTH_PX;
    const parsed = Number.parseInt(stored, 10);
    if (Number.isNaN(parsed)) return RIGHT_RAIL_DEFAULT_WIDTH_PX;
    return clampRailWidth(parsed);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RIGHT_RAIL_WIDTH_KEY, String(rightRailWidth));
  }, [rightRailWidth]);

  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const hasRightRail = Boolean(rightRail);
  const showRightRail = hasRightRail && !rightRailCollapsed;

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startWidth: rightRailWidth };
      setIsResizing(true);

      const handleMove = (moveEvent: PointerEvent) => {
        const ctx = dragRef.current;
        if (!ctx) return;
        // Handle sits on the left edge of the right rail, so dragging left grows it.
        const delta = ctx.startX - moveEvent.clientX;
        setRightRailWidth(clampRailWidth(ctx.startWidth + delta));
      };

      const handleUp = () => {
        dragRef.current = null;
        setIsResizing(false);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [rightRailWidth],
  );

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle is on the rail's left edge: ArrowLeft grows the rail, ArrowRight shrinks.
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setRightRailWidth((w) => clampRailWidth(w + RIGHT_RAIL_KEYBOARD_STEP_PX));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setRightRailWidth((w) => clampRailWidth(w - RIGHT_RAIL_KEYBOARD_STEP_PX));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setRightRailWidth(RIGHT_RAIL_MAX_WIDTH_PX);
    } else if (event.key === 'End') {
      event.preventDefault();
      setRightRailWidth(RIGHT_RAIL_MIN_WIDTH_PX);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setRightRailWidth(RIGHT_RAIL_DEFAULT_WIDTH_PX);
    }
  }, []);

  // Disable text selection + force resize cursor while a drag is in flight.
  useEffect(() => {
    if (!isResizing) return;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isResizing]);

  const reducedMotion = useReducedMotion();
  const railTransition =
    isResizing || reducedMotion
      ? { duration: 0 }
      : { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

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
              {sidebar ? (
                <aside aria-label="Channels" className="w-channel-list flex shrink-0 flex-col">
                  {sidebar}
                </aside>
              ) : null}
            </div>
            {/*
             * UserPanel is designed to span serverRail + sidebar. Without a
             * sidebar (e.g. whiteboard lab canvas) it would force the left
             * column wider than the server rail and leave a dark gap above
             * the pill. Hide it so the column collapses to w-server-list.
             */}
            {sidebar ? userPanel : null}
          </div>

          <div className="bg-glass-canvas flex min-w-0 flex-1 flex-col">
            {topBar || hasRightRail ? (
              <div className="flex shrink-0 items-stretch">
                {topBar ? <div className="min-w-0 flex-1">{topBar}</div> : null}
                {hasRightRail ? (
                  <div
                    className={cn(
                      'flex shrink-0 items-center pr-2 pl-1',
                      !topBar && 'border-glass-border h-app-titlebar border-b',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setRightRailCollapsed((c) => !c)}
                      aria-label={rightRailCollapsed ? 'Show side panel' : 'Hide side panel'}
                      aria-pressed={rightRailCollapsed}
                      className="text-ink-muted hover:bg-glass-hover hover:text-ink focus-visible:ring-blurple flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {rightRailCollapsed ? (
                        <PanelRightOpen className="size-4" aria-hidden />
                      ) : (
                        <PanelRightClose className="size-4" aria-hidden />
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1">
              <main className="flex min-w-0 flex-1 flex-col">{main}</main>

              {hasRightRail ? (
                <motion.aside
                  aria-label="Active now"
                  initial={false}
                  animate={{
                    width: showRightRail ? rightRailWidth : 0,
                    opacity: showRightRail ? 1 : 0,
                    borderLeftWidth: showRightRail ? 1 : 0,
                  }}
                  transition={railTransition}
                  className="bg-glass-chrome border-glass-border relative flex shrink-0 flex-col overflow-hidden"
                  aria-hidden={!showRightRail}
                >
                  {showRightRail ? (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize side panel"
                      aria-valuemin={RIGHT_RAIL_MIN_WIDTH_PX}
                      aria-valuemax={RIGHT_RAIL_MAX_WIDTH_PX}
                      aria-valuenow={rightRailWidth}
                      tabIndex={0}
                      onPointerDown={handleResizePointerDown}
                      onKeyDown={handleResizeKeyDown}
                      onDoubleClick={() => setRightRailWidth(RIGHT_RAIL_DEFAULT_WIDTH_PX)}
                      className={cn(
                        'group absolute top-0 left-0 z-10 flex h-full w-1.5 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center focus-visible:outline-none',
                        isResizing && 'bg-blurple/30',
                      )}
                    >
                      <span
                        className={cn(
                          'h-12 w-0.5 rounded-full transition-colors',
                          isResizing
                            ? 'bg-blurple'
                            : 'group-hover:bg-glass-border-strong group-focus-visible:bg-blurple bg-transparent',
                        )}
                        aria-hidden
                      />
                    </div>
                  ) : null}
                  <div className="flex h-full flex-col" style={{ width: rightRailWidth }}>
                    {rightRail}
                  </div>
                </motion.aside>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
