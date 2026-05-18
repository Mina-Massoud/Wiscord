import { Clock4 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getIdenticonDataUrl } from '@/lib/avatar';
import type { CalendarEvent } from '@/types/calendar';

interface IslandEventViewProps {
  event: CalendarEvent;
  minutesAway: number;
  /** Up to 3 attendee identities for the avatar stack. */
  attendees?: { identity: string; name: string }[];
}

/**
 * Event-soon card content (rendered at 340 × 72 by its Slot).
 * Sunlitt / Forest / Duolingo "compact live activity" grammar:
 * vertical blurple accent bar, title-stack, optional attendees,
 * countdown chip. The Slot wrapper owns sizing and fade variants.
 */
export function IslandEventView({
  event,
  minutesAway,
  attendees = [],
}: IslandEventViewProps): React.JSX.Element {
  const countdown = minutesAway <= 0 ? 'now' : minutesAway === 1 ? '1 min' : `${minutesAway} min`;
  return (
    <div className="flex h-full w-full items-center gap-3">
      <span aria-hidden className="bg-blurple h-10 w-[3px] shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-ink text-tab truncate leading-tight font-semibold">{event.title}</p>
        <p className="text-ink-muted text-xs tabular-nums">
          <Clock4 aria-hidden className="mr-1 inline size-3 -translate-y-px" />
          {formatTimeRange(event.startAt, event.endAt)}
        </p>
      </div>
      {attendees.length > 0 ? (
        <div className="flex shrink-0">
          {attendees.slice(0, 3).map((a) => (
            <Avatar key={a.identity} className="border-island ml-[-8px] size-6 border-2">
              <AvatarImage src={getIdenticonDataUrl(a.identity, 64)} alt="" />
              <AvatarFallback className="text-[10px]">
                {a.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      ) : null}
      <div className="bg-blurple/20 text-blurple text-badge inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums">
        <span aria-hidden className="bg-blurple size-1.5 rounded-full" />
        {countdown}
      </div>
    </div>
  );
}

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${fmt.format(new Date(startIso))} → ${fmt.format(new Date(endIso))}`;
}
