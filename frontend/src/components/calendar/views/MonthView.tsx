import { useMemo } from 'react';

import { cn } from '@/lib/cn';
import {
  addDays,
  dayLabel,
  isSameDay,
  isSameMonth,
  startOfMonthGrid,
  weekdayShortLabels,
} from '@/lib/calendar-date';
import type { CalendarCategory, CalendarEvent } from '@/types/calendar';
import { EventBlock } from '../EventBlock';
import { localDayIso, type BeginDragArgs } from '../useCalendarDrag';

interface MonthViewProps {
  cursor: Date;
  events: CalendarEvent[];
  categories: CalendarCategory[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectDay?: (day: Date) => void;
  onDragStart?: (args: BeginDragArgs, e: React.PointerEvent) => void;
  draggingId?: string | null;
}

const MAX_VISIBLE_PER_DAY = 3;

/**
 * Month grid: six-week fixed-height calendar starting on Monday. Events are
 * bucketed by local-time day. Days outside the current month read at lower
 * opacity so the focal month stays visually anchored.
 *
 * Layout math intentionally lives here (not in a hook) — the view is the
 * single consumer and a hook would just be an indirection.
 */
export function MonthView({
  cursor,
  events,
  categories,
  onSelectEvent,
  onSelectDay,
  onDragStart,
  draggingId = null,
}: MonthViewProps): React.JSX.Element {
  const weekdays = useMemo(() => weekdayShortLabels(), []);
  const days = useMemo(() => {
    const first = startOfMonthGrid(cursor);
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [cursor]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, CalendarCategory>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const eventsByDay = useMemo(() => groupEventsByDay(events, days), [events, days]);
  const today = new Date();

  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-caption text-ink-muted grid grid-cols-7 gap-1 px-1 tracking-wide uppercase"
        role="row"
      >
        {weekdays.map((label) => (
          <div key={label} role="columnheader" className="px-2 py-1">
            {label}
          </div>
        ))}
      </div>

      <div
        className="border-glass-border grid grid-cols-7 gap-1 overflow-hidden rounded-md border"
        role="grid"
      >
        {days.map((day, idx) => {
          const inCurrentMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const dayEvents = eventsByDay.get(idx) ?? [];
          const overflow = Math.max(0, dayEvents.length - MAX_VISIBLE_PER_DAY);

          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              aria-label={dayLabel(day)}
              onClick={() => onSelectDay?.(day)}
              data-calendar-drop={`day:${localDayIso(day)}`}
              className={cn(
                'group bg-glass-canvas flex h-32 flex-col gap-1 p-2 text-left',
                'border-glass-border border-r border-b last:border-r-0',
                'duration-fast ease-wiscord transition-colors',
                'hover:bg-glass-surface-1 focus-visible:outline-none',
                'focus-visible:ring-blurple/60 focus-visible:ring-2 focus-visible:ring-inset',
                !inCurrentMonth && 'opacity-50',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-caption rounded-pill inline-flex size-6 items-center justify-center tabular-nums',
                    isToday ? 'bg-blurple text-blurple-foreground font-semibold' : 'text-ink-muted',
                  )}
                >
                  {day.getDate()}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, MAX_VISIBLE_PER_DAY).map((ev) => (
                  <EventBlock
                    key={ev.occurrenceId}
                    event={ev}
                    category={categoryMap.get(ev.categoryId)}
                    onSelect={onSelectEvent}
                    onDragStart={onDragStart}
                    isDragging={draggingId === ev.id}
                  />
                ))}
                {overflow > 0 && (
                  <span className="text-caption text-ink-subtle px-2">+{overflow} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function groupEventsByDay(events: CalendarEvent[], days: Date[]): Map<number, CalendarEvent[]> {
  const out = new Map<number, CalendarEvent[]>();
  for (const ev of events) {
    const start = new Date(ev.startAt);
    const idx = days.findIndex((d) => isSameDay(d, start));
    if (idx < 0) continue;
    const bucket = out.get(idx) ?? [];
    bucket.push(ev);
    out.set(idx, bucket);
  }
  // Sort each bucket by start time so chips render chronologically.
  for (const bucket of out.values()) {
    bucket.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }
  return out;
}
