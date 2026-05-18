import { useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { isSameDay, timeLabel } from '@/lib/calendar-date';
import type { CalendarCategory, CalendarEvent } from '@/types/calendar';

import { CATEGORY_FILL_BG } from '../category-color';
import { localDayIso, type BeginDragArgs } from '../useCalendarDrag';
import { layoutDayEvents } from './time-grid-layout';
import { NowIndicator } from './NowIndicator';
import { HoverTimeIndicator } from './HoverTimeIndicator';

interface TimeGridProps {
  /** The days rendered as columns (1 for Day view, 7 for Week view). */
  days: Date[];
  events: CalendarEvent[];
  categories: CalendarCategory[];
  onSelectEvent?: (event: CalendarEvent) => void;
  /** Fires when an empty slot is clicked — caller opens the composer prefilled to this exact start time. */
  onSelectSlot?: (slotStart: Date, anchorRect: DOMRect) => void;
  onDragStart?: (args: BeginDragArgs, e: React.PointerEvent) => void;
  draggingId?: string | null;
  /** Pixels per hour. Defaults to 48 (matches the Tailwind h-12 row token). */
  hourHeightPx?: number;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Build the grid-template-columns rule for the time grid. The caller owns
 * the grid container (so it can also be the scroll container) — this just
 * keeps the column math in one place.
 */
export function timeGridColumns(dayCount: number): string {
  return `4rem repeat(${dayCount}, minmax(0, 1fr))`;
}

/**
 * Shared hour-grid renderer for Week and Day views. Returns a fragment of
 * grid-children — the caller is responsible for wrapping in a grid
 * container with `timeGridColumns(days.length)` and owning scroll.
 */
export function TimeGrid({
  days,
  events,
  categories,
  onSelectEvent,
  onSelectSlot,
  onDragStart,
  draggingId = null,
  hourHeightPx = 48,
}: TimeGridProps): React.JSX.Element {
  const categoryMap = useMemo(() => {
    const m = new Map<string, CalendarCategory>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const today = new Date();
  const totalHeight = 24 * hourHeightPx;

  // Per-column hover state. Tracks which column the pointer is in plus
  // the pixel Y inside that column so the floating indicator can paint
  // immediately. Only the active column is non-null at a time, so the
  // map stays small.
  const [hover, setHover] = useState<{ dayIso: string; y: number } | null>(null);

  return (
    <>
      <div className="border-glass-border bg-glass-chrome border-r" style={{ height: totalHeight }}>
        {HOURS.map((h) => (
          <div
            key={h}
            className="text-caption text-ink-subtle border-glass-border flex h-12 items-start justify-end border-b px-2 pt-1 tabular-nums"
          >
            {hourLabel(h)}
          </div>
        ))}
      </div>

      {days.map((day) => {
        const isToday = isSameDay(day, today);
        const positioned = layoutDayEvents(events, day, hourHeightPx);
        const dayIso = localDayIso(day);
        return (
          <div
            key={day.toISOString()}
            data-calendar-drop={`col:${dayIso}`}
            data-hour-px={hourHeightPx}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
              setHover({ dayIso, y });
            }}
            onPointerLeave={() => {
              setHover((prev) => (prev?.dayIso === dayIso ? null : prev));
            }}
            onClick={(e) => {
              // Ignore clicks that bubbled from an event tile — those open
              // edit, not create.
              const target = e.target as HTMLElement;
              if (target.closest('[data-calendar-event="true"]')) return;
              if (!onSelectSlot) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
              // Anchor the quick-add popover to a narrow band around the
              // click rather than the whole day column, so it appears
              // beside the user's pointer.
              const slotRect = new DOMRect(rect.left, rect.top + y - 20, rect.width, 40);
              onSelectSlot(slotDateFromY(day, y, hourHeightPx), slotRect);
            }}
            className={cn(
              'border-glass-border relative border-r last:border-r-0',
              isToday && 'bg-glass-surface-1/40',
              onSelectSlot && 'cursor-pointer',
            )}
            style={{ height: totalHeight }}
          >
            {HOURS.map((h) => (
              <div key={h} className="border-glass-border h-12 border-b" />
            ))}
            {isToday && <NowIndicator hourHeightPx={hourHeightPx} />}
            {hover?.dayIso === dayIso && (
              <HoverTimeIndicator y={hover.y} label={hoverTimeLabel(hover.y, hourHeightPx)} />
            )}
            {positioned.map(({ event, lane, lanes, top, height }) => {
              const category = categoryMap.get(event.categoryId);
              const color = category ? CATEGORY_FILL_BG[category.color] : 'bg-glass-surface-2';
              const isDragging = draggingId === event.id;
              return (
                <button
                  key={event.occurrenceId}
                  type="button"
                  data-calendar-event="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent?.(event);
                  }}
                  onPointerDown={(e) => {
                    if (!onDragStart) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    onDragStart(
                      {
                        event,
                        offsetX: e.clientX - rect.left,
                        offsetY: e.clientY - rect.top,
                      },
                      e,
                    );
                  }}
                  className={cn(
                    'group bg-glass-surface-1 hover:bg-glass-surface-2 absolute',
                    'border-glass-border rounded-md border text-left',
                    'duration-fast ease-wiscord overflow-hidden transition-colors',
                    'focus-visible:ring-blurple/60 focus-visible:ring-2 focus-visible:outline-none',
                    isDragging && 'opacity-40',
                  )}
                  style={{
                    top,
                    height,
                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                    width: `calc(${100 / lanes}% - 4px)`,
                  }}
                >
                  <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', color)} />
                  <div className="flex flex-col gap-0.5 px-2 py-1 pl-3">
                    <span className="text-control text-ink truncate font-medium">
                      {event.title}
                    </span>
                    <span className="text-caption text-ink-muted tabular-nums">
                      {timeLabel(new Date(event.startAt))}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function hourLabel(h: number): string {
  // Render 12-hour clock to match the reference design — "9 AM", "12 PM"…
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

function slotDateFromY(day: Date, y: number, hourHeightPx: number): Date {
  const totalMinutes = (y / hourHeightPx) * 60;
  // Snap to 15-minute increments so the prefilled time lines up with the
  // composer's recurrence + duration math.
  const snapped = Math.max(0, Math.min(24 * 60 - 15, Math.round(totalMinutes / 15) * 15));
  const out = new Date(day);
  out.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
  return out;
}

function hoverTimeLabel(y: number, hourHeightPx: number): string {
  const minutesFromMidnight = Math.max(
    0,
    Math.min(24 * 60 - 1, Math.round((y / hourHeightPx) * 60)),
  );
  // Snap to 5-minute increments so the chip doesn't jitter pixel-by-pixel.
  const snapped = Math.round(minutesFromMidnight / 5) * 5;
  const h24 = Math.floor(snapped / 60);
  const min = snapped % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${period}`;
}
