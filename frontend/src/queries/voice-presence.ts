import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { api, getSocket, type VoiceStateChange } from '@/queries/client';
import { qk } from '@/queries/keys';

export interface VoiceChannelParticipant {
  identity: string;
  name: string;
  joinedAt: number;
}

interface VoiceParticipantsResponse {
  participants: VoiceChannelParticipant[];
}

/**
 * Live list of users currently in a voice channel.
 *
 * Two data sources, one cache key:
 *  1. Initial fetch — REST snapshot from `GET /voice/:id/participants`,
 *     served out of the backend's in-memory presence store.
 *  2. Ongoing updates — Socket.IO `voice:state_changed` events. The handler
 *     writes the new participant list into the same cache via
 *     `setQueryData`, so the query re-renders without re-fetching.
 *
 * Stale-time is `Infinity` because the socket is the source of truth once
 * the snapshot lands — letting React Query background-refetch would race
 * with the socket and cause the sidebar to blink stale data.
 *
 * Reconnect: the socket's `connect` event refetches the snapshot so any
 * deltas missed during the disconnect are filled in.
 */
export function useVoiceChannelParticipants(
  channelId: string | undefined,
): UseQueryResult<VoiceChannelParticipant[]> {
  const queryClient = useQueryClient();

  const query = useQuery<VoiceChannelParticipant[]>({
    queryKey: channelId ? qk.voice.participants(channelId) : qk.voice.root,
    queryFn: async () => {
      const data = await api<VoiceParticipantsResponse>(`/voice/${channelId}/participants`);
      return data.participants;
    },
    enabled: Boolean(channelId),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();

    const onChange = (change: VoiceStateChange): void => {
      if (change.channelId !== channelId) return;
      queryClient.setQueryData<VoiceChannelParticipant[]>(
        qk.voice.participants(channelId),
        change.participants,
      );
    };

    const onConnect = (): void => {
      void queryClient.invalidateQueries({ queryKey: qk.voice.participants(channelId) });
    };

    socket.on('voice:state_changed', onChange);
    socket.on('connect', onConnect);
    return () => {
      socket.off('voice:state_changed', onChange);
      socket.off('connect', onConnect);
    };
  }, [channelId, queryClient]);

  return query;
}
