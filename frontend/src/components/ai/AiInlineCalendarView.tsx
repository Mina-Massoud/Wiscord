import { CalendarDays, X } from 'lucide-react';
import { Suspense, lazy } from 'react';

import { useSession } from '@/queries/auth';

interface AiInlineCalendarViewProps {
  /** The cited event's title — drives the pane header. */
  title: string;
  /** ISO datetime of the cited event. When provided, the embedded
   *  calendar opens in day-view scoped to this moment so the user
   *  lands on the right day without scrolling. */
  startAt?: string;
  onClose: () => void;
}

/**
 * Inline calendar embed for the AI capsule's source pane.
 * Lazy-loads `CalendarShell` so the calendar bundle only ships
 * when a user actually clicks an event chip (or asks the AI to
 * add an event in Phase 7). Personal scope only for v1
 * (channelId=null, ownerId=null → user's own events).
 */
const CalendarShellLazy = lazy(() =>
  import('@/components/calendar/CalendarShell').then((mod) => ({
    default: mod.CalendarShell,
  })),
);

export function AiInlineCalendarView({
  title,
  startAt,
  onClose,
}: AiInlineCalendarViewProps): React.JSX.Element {
  const session = useSession();
  const ownerId = session.data?.id ?? '';
  const initialDate = startAt ? new Date(startAt) : undefined;
  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="text-ink-muted size-4 shrink-0" aria-hidden />
        <span className="text-ink text-control min-w-0 flex-1 truncate font-semibold">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calendar view"
          className="text-ink-muted hover:text-ink shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/5"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="bg-glass-canvas min-h-0 flex-1 overflow-hidden rounded-2xl">
        <Suspense
          fallback={<div className="text-ink-muted text-control p-3">loading calendar…</div>}
        >
          {ownerId.length > 0 ? (
            <CalendarShellLazy
              channelId={null}
              ownerId={ownerId}
              initialDate={initialDate}
              initialView={initialDate ? 'day' : 'month'}
              initialScrollHour={initialDate ? initialDate.getHours() : undefined}
            />
          ) : (
            <div className="text-ink-muted text-control p-3">loading calendar…</div>
          )}
        </Suspense>
      </div>
    </div>
  );
}
