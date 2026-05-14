import { getRealtimeServer } from '../realtime/gateway.js';

/**
 * Small adapter that emits calendar-event change events into the right room.
 * Personal events emit to `user:<userId>` so other tabs of the same user
 * stay in sync; channel events emit to `channel:<channelId>:calendar`,
 * which clients join via the `calendar:subscribe_channel` socket event.
 *
 * Pull-only; never throws. The frontend re-fetches on every signal rather
 * than receiving the full event payload, so we don't have to keep the
 * wire shape and the DTO in lock-step.
 */
export type CalendarChangeKind = 'created' | 'updated' | 'deleted';

export function emitCalendarChange(args: {
  kind: CalendarChangeKind;
  userId: string;
  channelId: string | null;
  eventId: string;
}): void {
  const io = getRealtimeServer();
  if (!io) return;
  const room = args.channelId
    ? `channel:${args.channelId}:calendar`
    : `user:${args.userId}`;
  io.to(room).emit('calendar:event_changed', {
    kind: args.kind,
    channelId: args.channelId,
    eventId: args.eventId,
  });
}
