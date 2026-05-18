import { useMemo } from 'react';

import { cn } from '@/lib/cn';
import { addDays, dayLabel, isSameDay, startOfWeek, weekdayShortLabels } from '@/lib/calendar-date';
import type { CalendarCategory, CalendarEvent } from '@/types/calendar';

import { AllDayStrip } from './AllDayStrip';
import { TimeGrid, timeGridColumns } from './TimeGrid';

import type { BeginDragArgs } from '../useCalendarDrag';

interface WeekViewProps {
  cursor: Date;
  events: CalendarEvent[];
  categories: CalendarCategory[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotStart: Date, anchorRect: DOMRect) => void;
  onDragStart?: (args: BeginDragArgs, e: React.PointerEvent) => void;
  draggingId?: string | null;
}

export function WeekView({
  cursor,
  events,
  categories,
  onSelectEvent,
  onSelectSlot,
  onDragStart,
  draggingId,
}: WeekViewProps): React.JSX.Element {
  const days = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);
  const weekdayLabels = useMemo(() => weekdayShortLabels(), []);
  const today = new Date();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="border-glass-border bg-glass-chrome grid border-b"
        style={{ gridTemplateColumns: `4rem repeat(7, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((day, idx) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className="border-glass-border flex flex-col items-center gap-0.5 border-l px-2 py-2"
              aria-label={dayLabel(day)}
            >
              <span className="text-caption text-ink-muted tracking-wide uppercase">
                {weekdayLabels[idx]}
              </span>
              <span
                className={cn(
                  'text-subhead tabular-nums',
                  isToday
                    ? 'bg-blurple text-blurple-foreground rounded-pill inline-flex size-7 items-center justify-center font-semibold'
                    : 'text-ink',
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <AllDayStrip
        days={days}
        events={events}
        categories={categories}
        onSelectEvent={onSelectEvent}
      />

      <div
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
