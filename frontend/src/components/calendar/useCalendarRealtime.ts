import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getSocket, type CalendarEventChanged } from '@/queries/client';
import { qk } from '@/queries/keys';

/**
 * Subscribes to `calendar:event_changed` Socket.IO events for a calendar
 * scope and invalidates the matching React Query cache when a peer writes.
 *
 * Personal calendars receive events on the user's own room (`user:<id>`)
 * which the gateway auto-joins. Channel calendars require explicit
 * subscribe so we send the join request on mount and unsubscribe on
 * unmount — otherwise a single tab would keep getting events for channels
 * it isn't looking at anymore.
 */
export function useCalendarRealtime(channelId: string | null): void {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const handler = (change: CalendarEventChanged): void => {
      // The shell may be watching several windows simultaneously (one per
      // pre-cached query). Invalidating the scope root covers all of them.
      const matches = (change.channelId ?? null) === channelId;
      if (!matches) return;
      void qc.invalidateQueries({ queryKey: qk.calendar.eventsRoot(channelId) });
    };

    socket.on('calendar:event_changed', handler);

    let unsubscribe = (): void => {};
    if (channelId) {
      socket.emit('calendar:subscribe_channel', channelId, () => {
        // ack ignored — even if subscribe is rejected, the listener is
        // still attached so future emits would surface.
      });
      unsubscribe = () => {
        socket.emit('calendar:unsubscribe_channel', channelId);
      };
    }

    return () => {
      socket.off('calendar:event_changed', handler);
      unsubscribe();
    };
  }, [channelId, qc]);
}
