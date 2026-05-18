import { useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';
import { dayLabel, isSameDay } from '@/lib/calendar-date';
import type { CalendarCategory, CalendarEvent } from '@/types/calendar';

import { AllDayStrip } from './AllDayStrip';
import { TimeGrid, timeGridColumns } from './TimeGrid';

import type { BeginDragArgs } from '../useCalendarDrag';

const HOUR_PX = 48;

interface DayViewProps {
  cursor: Date;
  events: CalendarEvent[];
  categories: CalendarCategory[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotStart: Date, anchorRect: DOMRect) => void;
  onDragStart?: (args: BeginDragArgs, e: React.PointerEvent) => void;
  draggingId?: string | null;
  /** Scroll the time grid to this hour (0–23) on mount. Used
   *  when the calendar is opened from outside scoped to a
   *  specific event — without this the grid starts at midnight
   *  and the user has to find the event manually. */
  scrollToHour?: number;
}

export function DayView({
  cursor,
  events,
  categories,
  onSelectEvent,
  onSelectSlot,
  onDragStart,
  draggingId,
  scrollToHour,
}: DayViewProps): React.JSX.Element {
  const days = [cursor];
  const today = new Date();
  const isToday = isSameDay(cursor, today);

  const scrollRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);

  // Reset the "did scroll" guard whenever the target hour
  // changes — so opening the calendar a second time on a
  // different event still scrolls.
  useEffect(() => {
    didScrollRef.current = false;
  }, [scrollToHour]);

  // Run the scroll attempt on every render until it lands. The
  // first render fires before the TimeGrid layout has its full
  // height (Suspense / event-query loading), so a single
  // useEffect-on-mount silently no-ops. By re-attempting until
  // `scrollHeight > clientHeight` is true, we land the scroll as
  // soon as layout stabilizes. The `didScrollRef` guard means we
  // only fire `scrollTo` once per `scrollToHour` change, so a
  // smooth animation can run uninterrupted even though the effect
  // itself has no deps array.
  useEffect(() => {
    if (scrollToHour === undefined || didScrollRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight) return;
    const target = Math.max(0, scrollToHour - 1) * HOUR_PX;
    el.scrollTo({ top: target, behavior: scrollBehavior() });
    didScrollRef.current = true;
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="border-glass-border bg-glass-chrome grid border-b"
        style={{ gridTemplateColumns: `4rem minmax(0, 1fr)` }}
      >
        <div />
        <div className="flex items-baseline gap-2 px-3 py-2">
          <span
            className={cn(
              'text-subhead tabular-nums',
              isToday
                ? 'bg-blurple text-blurple-foreground rounded-pill inline-flex size-7 items-center justify-center font-semibold'
                : 'text-ink',
            )}
          >
            {cursor.getDate()}
          </span>
          <span className="text-caption text-ink-muted tracking-wide uppercase">
            {dayLabel(cursor)}
          </span>
        </div>
      </div>

      <AllDayStrip
        days={days}
        events={events}
        categories={categories}
        onSelectEvent={onSelectEvent}
      />

      <div
        ref={scrollRef}
        className="border-glass-border bg-glass-canvas grid flex-1 overflow-auto rounded-md border"
        style={{ gridTemplateColumns: timeGridColumns(days.length) }}
      >
        <TimeGrid
          days={days}
          events={events}
          categories={categories}
          onSelectEvent={onSelectEvent}
          onSelectSlot={onSelectSlot}
          onDragStart={onDragStart}
          draggingId={draggingId}
        />
      </div>
    </div>
  );
}

/**
 * Pick `'auto'` (instant) when the user prefers reduced motion,
 * `'smooth'` otherwise. Read at call time — the OS-level setting
 * can change while the app is running.
 */
function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
