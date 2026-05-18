import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import {
  addDays,
  addMonths,
  dayLabel,
  endOfMonthGrid,
  endOfWeek,
  isSameDay,
  monthTitle,
  startOfDay,
  endOfDay,
  startOfMonthGrid,
  startOfWeek,
} from '@/lib/calendar-date';
import { useCalendarCategories, useCalendarEvents, useUpdateEvent } from '@/queries/calendar';
import { qk } from '@/queries/keys';
import { toast } from '@/lib/toast';
import type { CalendarEvent, CalendarView } from '@/types/calendar';

import { CalendarEmpty } from './CalendarEmpty';
import { CalendarSkeleton } from './CalendarSkeleton';
import { CategoryManager } from './CategoryManager';
import { DragGhost } from './DragGhost';
import { EventComposer } from './EventComposer';
import { EventQuickAddPopover } from './EventQuickAddPopover';
import { useCalendarRealtime } from './useCalendarRealtime';
import { useCalendarShortcuts } from './useCalendarShortcuts';
import { useCalendarDrag, type BeginDragArgs } from './useCalendarDrag';
import { AgendaView } from './views/AgendaView';
import { DayView } from './views/DayView';
import { MonthView } from './views/MonthView';
import { WeekView } from './views/WeekView';

interface CalendarShellProps {
  /** `null` for the personal calendar; channel UUID for a shared one. */
  channelId: string | null;
  ownerId: string;
  /** Initial cursor date — used when the calendar opens scoped to a
   *  specific moment (e.g. the AI capsule opens it on a cited event's
   *  day). Defaults to "today". */
  initialDate?: Date;
  /** Initial view — when scoping to a single day we want 'day' view,
   *  otherwise the default 'month'. */
  initialView?: CalendarView;
  /** Hour (0–23) to scroll the day grid to on mount. When opening
   *  from a cited event, derive from the event's start time so
   *  the user sees the event without scrolling. */
  initialScrollHour?: number;
}

/**
 * The composer has two surfaces:
 *
 *   - `quick` — small Popover anchored to the clicked day/slot cell.
 *     Covers the 90% case (title + when + maybe a note) without a
 *     modal. Set automatically when the user clicks a cell.
 *   - `full` — the original EventComposer Dialog. Used for editing
 *     existing events, or when the user clicks "Add details" in the
 *     quick popover to promote.
 */
interface ComposerState {
  mode: 'closed' | 'quick' | 'full';
  editing: CalendarEvent | null;
  prefillDay: Date | null;
  /** Bounding rect of the clicked cell; popover anchors here. */
  anchorRect: DOMRect | null;
}

/**
 * The chrome around every calendar view. Owns:
 * - the date cursor (which window we're looking at)
 * - the view kind (month / week / day / agenda)
 * - the data fetch for the current window
 *
 * Sub-views are stateless presentations; the shell hands them the data they
 * need plus event-selection callbacks.
 */
export function CalendarShell({
  channelId,
  ownerId,
  initialDate,
  initialView,
  initialScrollHour,
}: CalendarShellProps): React.JSX.Element {
  const [cursor, setCursor] = useState<Date>(() => initialDate ?? new Date());
  const [view, setView] = useState<CalendarView>(initialView ?? 'month');
  const [composer, setComposer] = useState<ComposerState>({
    mode: 'closed',
    editing: null,
    prefillDay: null,
    anchorRect: null,
  });
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  // Cell-click create flow → quick popover anchored to the cell rect.
  // The `null` rect path (e.g. keyboard shortcut "n") falls through to
  // the full Dialog because there's nothing to anchor a popover to.
  const openCreate = (day: Date | null = null, anchorRect: DOMRect | null = null): void =>
    setComposer({
      mode: anchorRect ? 'quick' : 'full',
      editing: null,
      prefillDay: day,
      anchorRect,
    });
  const openEdit = (event: CalendarEvent): void =>
    setComposer({ mode: 'full', editing: event, prefillDay: null, anchorRect: null });
  const setComposerOpen = (open: boolean): void =>
    setComposer((s) => (open ? s : { ...s, mode: 'closed' }));
  // Quick → full promotion. Keeps any rect around in case we want to
  // re-anchor later, but the Dialog itself centers regardless.
  const promoteToFull = (): void => setComposer((s) => ({ ...s, mode: 'full' }));

  useCalendarRealtime(channelId);

  useCalendarShortcuts({
    enabled: composer.mode === 'closed' && !categoryManagerOpen,
    onSetView: setView,
    onToday: () => setCursor(new Date()),
    onPrev: () => setCursor((c) => stepCursor(c, view, -1)),
    onNext: () => setCursor((c) => stepCursor(c, view, 1)),
    onNewEvent: () => openCreate(null),
  });

  const updateForDrag = useUpdateEvent('');
  const drag = useCalendarDrag({
    onCommit: async (event, newStartAt) => {
      const durationMs = new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
      const newEndAt = new Date(newStartAt.getTime() + durationMs);
      try {
        // Pass the eventId through the mutation closure — the URL is built
        // from the hook's `eventId` arg, which we override by calling fetch
        // directly via the wire format.
        await rescheduleEvent({ event, newStartAt, newEndAt, channelId });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't reschedule.");
      }
    },
  });
  // Silences the unused-binding warning for the placeholder hook above.
  void updateForDrag;
  const onDragStart = (args: BeginDragArgs, e: React.PointerEvent): void => drag.beginDrag(args, e);

  const window = useMemo(() => computeWindow(cursor, view), [cursor, view]);

  const eventsQuery = useCalendarEvents({
    from: window.from,
    to: window.to,
    channelId,
  });

  const categoriesQuery = useCalendarCategories({
    scope: channelId ? 'channel' : 'user',
    ownerId,
  });

  const events = eventsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  return (
    <section className="flex h-full w-full flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor((c) => stepCursor(c, view, -1))}
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(new Date())}
            title="Jump to today"
          >
            {isSameDay(cursor, new Date()) ? 'Today' : dayLabel(cursor)}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor((c) => stepCursor(c, view, 1))}
            aria-label="Next"
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="text-subhead text-ink ml-2 font-semibold">{monthTitle(cursor)}</h2>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCategoryManagerOpen(true)}
            aria-label="Manage categories"
          >
            <Settings2 className="size-4" />
          </Button>
          <Button onClick={() => openCreate(null)} size="sm" className="gap-1">
            <Plus className="size-4" aria-hidden />
            New event
          </Button>
        </div>
      </header>

      <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden')}>
        {eventsQuery.isLoading ? (
          <CalendarSkeleton />
        ) : eventsQuery.isError ? (
          <ErrorState onRetry={() => eventsQuery.refetch()} />
        ) : view === 'month' ? (
          <MonthView
            cursor={cursor}
            events={events}
            categories={categories}
            onSelectEvent={openEdit}
            onSelectDay={openCreate}
            onDragStart={onDragStart}
            draggingId={drag.draggingId}
          />
        ) : view === 'week' ? (
          <WeekView
            cursor={cursor}
            events={events}
            categories={categories}
            onSelectEvent={openEdit}
            onSelectSlot={openCreate}
            onDragStart={onDragStart}
            draggingId={drag.draggingId}
          />
        ) : view === 'day' ? (
          <DayView
            cursor={cursor}
            events={events}
            categories={categories}
            onSelectEvent={openEdit}
            onSelectSlot={openCreate}
            onDragStart={onDragStart}
            draggingId={drag.draggingId}
            scrollToHour={initialScrollHour}
          />
        ) : events.length === 0 ? (
          <CalendarEmpty onCreate={() => openCreate(null)} />
        ) : (
          <AgendaView events={events} categories={categories} onSelectEvent={openEdit} />
        )}
      </div>

      <EventQuickAddPopover
        open={composer.mode === 'quick'}
        onOpenChange={setComposerOpen}
        anchorRect={composer.anchorRect}
        prefillDay={composer.prefillDay}
        channelId={channelId}
        categories={categories}
        onPromoteToFull={promoteToFull}
      />

      <EventComposer
        open={composer.mode === 'full'}
        onOpenChange={setComposerOpen}
        channelId={channelId}
        categories={categories}
        editing={composer.editing}
        prefillDay={composer.prefillDay}
      />

      <CategoryManager
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
        categories={categories}
        scope={channelId ? 'channel' : 'user'}
        channelId={channelId}
      />

      <DragGhost ghost={drag.ghost} />
    </section>
  );
}

/**
 * Reschedule a single event directly through `api()` so we don't have to
 * conditionally rebuild the `useUpdateEvent` hook per dragged id.
 */
async function rescheduleEvent(args: {
  event: CalendarEvent;
  newStartAt: Date;
  newEndAt: Date;
  channelId: string | null;
}): Promise<void> {
  const { api } = await import('@/queries/client');
  const { queryClient } = await import('@/queries/client');
  await api(`/calendar/events/${args.event.id}`, {
    method: 'PATCH',
    body: {
      startAt: args.newStartAt.toISOString(),
      endAt: args.newEndAt.toISOString(),
    },
  });
  void queryClient.invalidateQueries({ queryKey: qk.calendar.eventsRoot(args.channelId) });
  toast.success('Event rescheduled');
}

function ErrorState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="border-glass-border bg-glass-callout flex flex-col items-center gap-3 rounded-lg border p-8 text-center">
      <p className="text-subhead text-ink">Couldn't load your calendar</p>
      <p className="text-caption text-ink-muted">Network hiccup, probably. Want to try again?</p>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function stepCursor(cursor: Date, view: CalendarView, dir: -1 | 1): Date {
  if (view === 'month' || view === 'agenda') return addMonths(cursor, dir);
  if (view === 'week') return addDays(cursor, 7 * dir);
  return addDays(cursor, dir);
}

function computeWindow(cursor: Date, view: CalendarView): { from: string; to: string } {
  if (view === 'month' || view === 'agenda') {
    return {
      from: startOfMonthGrid(cursor).toISOString(),
      to: endOfMonthGrid(cursor).toISOString(),
    };
  }
  if (view === 'week') {
    return { from: startOfWeek(cursor).toISOString(), to: endOfWeek(cursor).toISOString() };
  }
  return { from: startOfDay(cursor).toISOString(), to: endOfDay(cursor).toISOString() };
}
