import type { CalendarEvent } from '@/types/calendar';

/**
 * Compact next-event pill (240 × 26) used when the user has picked
 * `next-event` as their idle widget AND there's an event today that
 * isn't imminent (>15 min). When it crosses the 15-min threshold, the
 * shape upgrades to `event-soon` (340 × 72) via the layout morph.
 */
export function NextEventPill({ event }: { event: CalendarEvent }): React.JSX.Element {
  const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="flex h-full w-full items-center">
      <span aria-hidden className="bg-blurple size-1.5 shrink-0 rounded-full" />
      <span className="text-ink text-badge ml-2 min-w-0 flex-1 truncate font-semibold">
        {event.title}
      </span>
      <span className="text-ink-muted text-badge ml-2 shrink-0 tabular-nums">
        {fmt.format(new Date(event.startAt))}
      </span>
    </div>
  );
}
