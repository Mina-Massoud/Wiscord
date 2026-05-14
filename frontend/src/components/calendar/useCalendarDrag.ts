import { useCallback, useEffect, useRef, useState } from 'react';

import type { CalendarEvent } from '@/types/calendar';

/**
 * Pointer-event reschedule hook shared by month / week / day views.
 *
 * The shell owns the commit callback (calls `useUpdateEvent.mutate`). Views
 * register drop zones via `data-calendar-drop="..."` on their day-cell or
 * hour-column container. The hook hit-tests with `elementFromPoint` and
 * decodes the date from the dataset.
 *
 * Drop-zone encoding:
 *   - Month view  → `data-calendar-drop="day:YYYY-MM-DD"`
 *   - Time grid   → `data-calendar-drop="col:YYYY-MM-DD"` (with the column
 *                    bounds + pixel-per-hour read off the same node)
 *
 * The hook returns `{ beginDrag, isDragging, draggingId, ghost }`. Views
 * place a tiny floating ghost element at `ghost.x / ghost.y` while drag is
 * active so the user gets immediate visual feedback.
 */

export interface DragGhost {
  x: number;
  y: number;
  title: string;
}

export type CalendarDropSpec =
  | { kind: 'day'; day: Date }
  | { kind: 'col'; day: Date; minutesFromMidnight: number };

export interface BeginDragArgs {
  event: CalendarEvent;
  /** Where the pointer landed within the dragged tile, so the ghost stays put. */
  offsetX: number;
  offsetY: number;
}

interface UseCalendarDragArgs {
  /** Called when the pointer is released over a valid drop target. */
  onCommit: (event: CalendarEvent, newStartAt: Date) => void;
}

interface UseCalendarDragResult {
  beginDrag: (args: BeginDragArgs, pointerEvent: React.PointerEvent) => void;
  isDragging: boolean;
  draggingId: string | null;
  ghost: DragGhost | null;
}

const DRAG_THRESHOLD_PX = 4;

export function useCalendarDrag(args: UseCalendarDragArgs): UseCalendarDragResult {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);

  const eventRef = useRef<CalendarEvent | null>(null);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const armedRef = useRef(false);

  const reset = useCallback(() => {
    eventRef.current = null;
    armedRef.current = false;
    setDraggingId(null);
    setGhost(null);
  }, []);

  const beginDrag = useCallback(
    ({ event, offsetX, offsetY }: BeginDragArgs, e: React.PointerEvent) => {
      // Only left-button / primary pointer.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      eventRef.current = event;
      offsetRef.current = { x: offsetX, y: offsetY };
      startRef.current = { x: e.clientX, y: e.clientY };
      armedRef.current = true;
    },
    [],
  );

  useEffect(() => {
    function handleMove(e: PointerEvent): void {
      if (!eventRef.current) return;
      if (!armedRef.current) return;
      // Wait until the pointer has moved past the click-vs-drag threshold so
      // a plain click still opens the composer instead of starting a drag.
      if (!draggingId) {
        const dx = Math.abs(e.clientX - startRef.current.x);
        const dy = Math.abs(e.clientY - startRef.current.y);
        if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
        setDraggingId(eventRef.current.id);
      }
      setGhost({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
        title: eventRef.current.title,
      });
    }

    function handleUp(e: PointerEvent): void {
      if (!eventRef.current) {
        reset();
        return;
      }
      if (!draggingId) {
        // Below threshold → treat as a click. The tile's onClick already
        // handles the open-composer flow; nothing to commit.
        reset();
        return;
      }
      const drop = resolveDropTarget(e.clientX, e.clientY);
      if (drop) {
        const newStart = applyDrop(eventRef.current, drop);
        args.onCommit(eventRef.current, newStart);
      }
      reset();
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', reset);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', reset);
    };
  }, [args, draggingId, reset]);

  return {
    beginDrag,
    isDragging: draggingId !== null,
    draggingId,
    ghost,
  };
}

function resolveDropTarget(clientX: number, clientY: number): CalendarDropSpec | null {
  const node = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (!node) return null;
  const target = node.closest('[data-calendar-drop]') as HTMLElement | null;
  if (!target) return null;

  const raw = target.dataset['calendarDrop'] ?? '';
  const [kind, isoDate] = raw.split(':');
  if (!isoDate) return null;
  const day = parseLocalDay(isoDate);
  if (!day) return null;

  if (kind === 'day') return { kind: 'day', day };
  if (kind === 'col') {
    const rect = target.getBoundingClientRect();
    const hourHeight = Number(target.dataset['hourPx'] ?? '48');
    const yWithin = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const minutes = (yWithin / hourHeight) * 60;
    const snapped = Math.round(minutes / 15) * 15;
    return { kind: 'col', day, minutesFromMidnight: Math.max(0, Math.min(24 * 60 - 15, snapped)) };
  }
  return null;
}

function applyDrop(event: CalendarEvent, drop: CalendarDropSpec): Date {
  const oldStart = new Date(event.startAt);
  const next = new Date(drop.day);
  if (drop.kind === 'day') {
    // Preserve time-of-day from the original.
    next.setHours(
      oldStart.getHours(),
      oldStart.getMinutes(),
      oldStart.getSeconds(),
      oldStart.getMilliseconds(),
    );
  } else {
    const hours = Math.floor(drop.minutesFromMidnight / 60);
    const mins = drop.minutesFromMidnight % 60;
    next.setHours(hours, mins, 0, 0);
  }
  return next;
}

function parseLocalDay(iso: string): Date | null {
  // Expect "YYYY-MM-DD". Avoid `new Date(iso)` which interprets bare dates as UTC.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return new Date(y, m - 1, d);
}

export function localDayIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
