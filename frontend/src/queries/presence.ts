import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { api, getSocket, type PresenceChange, type PresenceStatus } from '@/queries/client';
import { qk } from '@/queries/keys';

export type PresenceMap = Record<string, PresenceStatus>;

interface PresenceEnvelope {
  presence: PresenceMap;
}

/**
 * Presence map for a set of users (typically the caller's friends).
 *
 * Two data sources, one cache key (mirrors `useVoiceChannelParticipants`):
 *  1. Initial fetch — REST snapshot from `GET /presence?userIds=…`.
 *  2. Ongoing updates — Socket.IO `presence:changed` events merged into the
 *     same cache via `setQueryData`, so the list re-renders without refetching.
 *
 * `staleTime: Infinity` because the socket is the source of truth once the
 * snapshot lands; a background refetch would race the socket and blink stale
 * dots. The socket's `connect` event refetches to fill any gap from a drop.
 *
 * Subscribe to *all* presence changes (not just the requested ids) and merge —
 * the gateway only delivers a user's friends' changes anyway, and merging an
 * id we didn't ask about is harmless.
 */
export function usePresence(userIds: string[]): UseQueryResult<PresenceMap> {
  const queryClient = useQueryClient();
  const enabled = userIds.length > 0;
  // Sort so the queryFn closure is stable regardless of caller ordering.
  const idsParam = [...userIds].sort().join(',');

  const query = useQuery<PresenceMap>({
    queryKey: qk.presence.users(),
    queryFn: async () => {
      const data = await api<PresenceEnvelope>('/presence', { search: { userIds: idsParam } });
      return data.presence;
    },
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  // When the friend set changes (someone added/removed), refresh the snapshot
  // so a newly-added friend who is already online shows up without waiting for
  // their next status toggle.
  useEffect(() => {
    if (enabled) void queryClient.invalidateQueries({ queryKey: qk.presence.users() });
  }, [idsParam, enabled, queryClient]);

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();

    const onChange = (change: PresenceChange): void => {
      queryClient.setQueryData<PresenceMap>(qk.presence.users(), (prev) => ({
        ...(prev ?? {}),
        [change.userId]: change.status,
      }));
    };

    const onConnect = (): void => {
      void queryClient.invalidateQueries({ queryKey: qk.presence.users() });
    };

    socket.on('presence:changed', onChange);
    socket.on('connect', onConnect);
    return () => {
      socket.off('presence:changed', onChange);
      socket.off('connect', onConnect);
    };
  }, [enabled, queryClient]);

  return query;
}
