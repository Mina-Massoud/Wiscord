import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getSocket } from '@/queries/client';
import { qk } from '@/queries/keys';
import type { EventWithMeta } from '@/types/event';
import { toast } from '@/lib/toast';
import type { Profile } from '@/types/auth';

/**
 * Subscribes to real-time server event updates for a given server.
 * Joins the `server:<serverId>:events` Socket.IO room and keeps the
 * TanStack Query cache in sync with create / update / delete / RSVP changes.
 *
 * Mount this hook on the events page and unmount with it — it cleans up
 * its subscription automatically.
 */
export function useServerEventsRealtime(serverId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!serverId) return;

    const socket = getSocket();

    // Join the server events room
    socket.emit('server_events:subscribe', serverId, (ok) => {
      if (!ok) return;
    });

    const listKey = qk.events.byServer(serverId);

    socket.on('server_event:created', ({ serverId: sid, event }) => {
      if (sid !== serverId) return;

      // Show toast if the event was not created by the current user
      const currentUser = qc.getQueryData<Profile | null>(qk.auth.session());
      if (currentUser && event.creatorId !== currentUser.id) {
        toast.info(
          `New Event: "${event.title}"`,
          { description: `Scheduled by ${event.creator.displayName}. Click Events in the sidebar to view.` }
        );
      }

      // Prepend the new event to the list
      qc.setQueryData<EventWithMeta[]>(listKey, (old) => {
        if (!old) return [event];
        // Avoid duplicates (optimistic may have landed already)
        const exists = old.some((e) => e.id === event.id);
        return exists ? old.map((e) => (e.id === event.id ? event : e)) : [event, ...old];
      });
    });

    socket.on('server_event:updated', ({ serverId: sid, eventId, event }) => {
      if (sid !== serverId) return;
      qc.setQueryData<EventWithMeta[]>(listKey, (old) =>
        old?.map((e) => (e.id === eventId ? event : e)),
      );
      qc.setQueryData<EventWithMeta>(qk.events.byId(eventId), event);
    });

    socket.on('server_event:deleted', ({ serverId: sid, eventId }) => {
      if (sid !== serverId) return;
      qc.setQueryData<EventWithMeta[]>(listKey, (old) =>
        old?.filter((e) => e.id !== eventId),
      );
      qc.removeQueries({ queryKey: qk.events.byId(eventId) });
    });

    socket.on('server_event:rsvp_changed', ({ serverId: sid, eventId, goingCount, interestedCount }) => {
      if (sid !== serverId) return;
      const patchCounts = (ev: EventWithMeta): EventWithMeta => ({
        ...ev,
        goingCount,
        interestedCount,
      });
      qc.setQueryData<EventWithMeta[]>(listKey, (old) =>
        old?.map((e) => (e.id === eventId ? patchCounts(e) : e)),
      );
      qc.setQueryData<EventWithMeta>(qk.events.byId(eventId), (old) =>
        old ? patchCounts(old) : old,
      );
    });

    return () => {
      socket.emit('server_events:unsubscribe', serverId);
      socket.off('server_event:created');
      socket.off('server_event:updated');
      socket.off('server_event:deleted');
      socket.off('server_event:rsvp_changed');
    };
  }, [serverId, qc]);
}
