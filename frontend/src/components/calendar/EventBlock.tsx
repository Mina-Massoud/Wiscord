import { cn } from '@/lib/cn';

import type { CalendarCategory, CalendarEvent } from '@/types/calendar';
import { CATEGORY_FILL_BG } from './category-color';
import { timeLabel } from '@/lib/calendar-date';
import type { BeginDragArgs } from './useCalendarDrag';

interface EventBlockProps {
  event: CalendarEvent;
  category: CalendarCategory | undefined;
  variant?: 'chip' | 'tile';
  onSelect?: (event: CalendarEvent) => void;
  /** Pointer-down handler — opt-in drag start. */
  onDragStart?: (args: BeginDragArgs, e: React.PointerEvent) => void;
  /** True while THIS event is the one being dragged, so it can fade out. */
  isDragging?: boolean;
}

/**
 * A single calendar event tile.
 *
 * - `chip` — compact form for the month grid (one row per event, hugged tight).
 * - `tile` — fuller form for week / day grids (color stripe + title + time).
 *
 * The triggering element is a real `<button>` so keyboard nav and focus
 * rings come for free. Drag is opt-in via `onDragStart`; below the drag
 * threshold the click handler still fires (open-composer flow).
 */
export function EventBlock({
  event,
  category,
  variant = 'chip',
  onSelect,
  onDragStart,
  isDragging = false,
}: EventBlockProps): React.JSX.Element {
  const colorClass = category ? CATEGORY_FILL_BG[category.color] : 'bg-glass-surface-2';
  const start = new Date(event.startAt);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
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
  };

  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(event)}
        onPointerDown={handlePointerDown}
        className={cn(
          'group flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left',
          'text-caption text-ink duration-fast ease-wiscord transition-colors',
          'hover:bg-glass-hover focus-visible:ring-2 focus-visible:outline-none',
          'focus-visible:ring-blurple/60',
          isDragging && 'opacity-40',
        )}
      >
        <span aria-hidden className={cn('rounded-pill inline-block size-2 shrink-0', colorClass)} />
        {!event.allDay && (
          <span className="text-ink-subtle shrink-0 tabular-nums">{timeLabel(start)}</span>
        )}
        <span className="truncate">{event.title}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      onPointerDown={handlePointerDown}
      className={cn(
        'group relative flex w-full flex-col gap-1 overflow-hidden rounded-md',
        'border-glass-border bg-glass-surface-1 border px-3 py-2 text-left',
        'duration-fast ease-wiscord hover:bg-glass-surface-2 transition-colors',
        'focus-visible:ring-blurple/60 focus-visible:ring-2 focus-visible:outline-none',
        isDragging && 'opacity-40',
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', colorClass)} />
      <span className="text-control text-ink truncate pl-2 font-medium">{event.title}</span>
      {!event.allDay && (
        <span className="text-caption text-ink-muted pl-2 tabular-nums">{timeLabel(start)}</span>
      )}
    </button>
  );
}
