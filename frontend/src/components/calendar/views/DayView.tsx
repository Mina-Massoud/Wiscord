import { cn } from '@/lib/cn';
import { dayLabel, isSameDay } from '@/lib/calendar-date';
import type { CalendarCategory, CalendarEvent } from '@/types/calendar';

import { AllDayStrip } from './AllDayStrip';
import { TimeGrid } from './TimeGrid';

import type { BeginDragArgs } from '../useCalendarDrag';

interface DayViewProps {
  cursor: Date;
  events: CalendarEvent[];
  categories: CalendarCategory[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotStart: Date) => void;
  onDragStart?: (args: BeginDragArgs, e: React.PointerEvent) => void;
  draggingId?: string | null;
}

export function DayView({
  cursor,
  events,
  categories,
  onSelectEvent,
  onSelectSlot,
  onDragStart,
  draggingId,
}: DayViewProps): React.JSX.Element {
  const days = [cursor];
  const today = new Date();
  const isToday = isSameDay(cursor, today);

  return (
    <div className="flex flex-col">
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

      <div className="flex-1 overflow-auto">
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
