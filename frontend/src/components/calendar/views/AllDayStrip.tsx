import { cn } from '@/lib/cn';
import { isSameDay } from '@/lib/calendar-date';
import type { CalendarCategory, CalendarEvent } from '@/types/calendar';

import { CATEGORY_FILL_BG } from '../category-color';

interface AllDayStripProps {
  days: Date[];
  events: CalendarEvent[];
  categories: CalendarCategory[];
  onSelectEvent?: (event: CalendarEvent) => void;
}

/**
 * Horizontal strip above the hour grid that surfaces `allDay` events.
 * Mirrors the column layout of `TimeGrid` so the columns line up exactly
 * (4 rem gutter + N day columns).
 */
export function AllDayStrip({
  days,
  events,
  categories,
  onSelectEvent,
}: AllDayStripProps): React.JSX.Element | null {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const hasAny = events.some((e) => e.allDay);
  if (!hasAny) return null;

  return (
    <div
      className="border-glass-border bg-glass-chrome grid border-b"
      style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
    >
      {/* Empty gutter — aligns with the hour-label column below so day
          columns line up perfectly. No "ALL-DAY" label; the visual
          separation of the strip already signals what it is. */}
      <div className="border-glass-border border-r" aria-hidden />
      <span className="sr-only">All-day events</span>
      {days.map((day) => {
        const bucket = events.filter((e) => e.allDay && isSameDay(new Date(e.startAt), day));
        return (
          <div
            key={day.toISOString()}
            className="border-glass-border flex flex-col gap-1 border-r p-1 last:border-r-0"
          >
            {bucket.map((ev) => {
              const c = categoryMap.get(ev.categoryId);
              const color = c ? CATEGORY_FILL_BG[c.color] : 'bg-glass-surface-2';
              return (
                <button
                  key={ev.occurrenceId}
                  type="button"
                  onClick={() => onSelectEvent?.(ev)}
                  className={cn(
                    'bg-glass-surface-1 text-ink hover:bg-glass-surface-2 truncate',
                    'border-glass-border text-caption rounded-sm border px-2 py-1 text-left',
                    'duration-fast ease-wiscord transition-colors',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('rounded-pill mr-2 inline-block size-2', color)}
                  />
                  {ev.title}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
