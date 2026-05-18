import { useMemo } from 'react';

import { cn } from '@/lib/cn';
import { dayLabel, isSameDay, startOfDay, timeLabel } from '@/lib/calendar-date';
import type { CalendarCategory, CalendarEvent } from '@/types/calendar';
import { CATEGORY_FILL_BG } from '../category-color';

interface AgendaViewProps {
  events: CalendarEvent[];
  categories: CalendarCategory[];
  onSelectEvent?: (event: CalendarEvent) => void;
}

/**
 * Flat list grouped by day. Empty days are elided. Used for narrow viewports
 * and as the keyboard-first scan view when the grid would be too dense.
 */
export function AgendaView({
  events,
  categories,
  onSelectEvent,
}: AgendaViewProps): React.JSX.Element {
  const categoryMap = useMemo(() => {
    const m = new Map<string, CalendarCategory>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const groups = useMemo(() => groupByDay(events), [events]);

  if (groups.length === 0) {
    return (
      <div className="h-full min-h-0 overflow-auto">
        <p className="text-caption text-ink-muted px-4 py-8 text-center">
          Nothing scheduled in this window.
        </p>
      </div>
    );
  }

  return (
    <ol className="border-glass-border divide-glass-border bg-glass-canvas h-full min-h-0 divide-y overflow-auto rounded-md border">
      {groups.map(({ day, items }) => (
        <li key={day.toISOString()} className="px-4 py-3">
          <p className="text-caption text-ink-muted mb-2 tracking-wide uppercase">
            {dayLabel(day)}
          </p>
          <ul className="space-y-1">
            {items.map((ev) => {
              const category = categoryMap.get(ev.categoryId);
              const color = category ? CATEGORY_FILL_BG[category.color] : 'bg-glass-surface-2';
              return (
                <li key={ev.occurrenceId}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent?.(ev)}
                    className={cn(
                      'hover:bg-glass-hover flex w-full items-center gap-3 rounded-sm px-2 py-1.5',
                      'text-control text-ink duration-fast ease-wiscord text-left transition-colors',
                      'focus-visible:ring-blurple/60 focus-visible:ring-2 focus-visible:outline-none',
                    )}
                  >
                    <span aria-hidden className={cn('rounded-pill inline-block size-2', color)} />
                    <span className="flex-1 truncate">{ev.title}</span>
                    {!ev.allDay && (
                      <span className="text-caption text-ink-muted tabular-nums">
                        {timeLabel(new Date(ev.startAt))}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function groupByDay(events: CalendarEvent[]): { day: Date; items: CalendarEvent[] }[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const out: { day: Date; items: CalendarEvent[] }[] = [];
  for (const ev of sorted) {
    const dayStart = startOfDay(new Date(ev.startAt));
    const last = out[out.length - 1];
    if (last && isSameDay(last.day, dayStart)) {
      last.items.push(ev);
    } else {
      out.push({ day: dayStart, items: [ev] });
    }
  }
  return out;
}
