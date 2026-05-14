import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { api, getSocket, type WatchPartySnapshot, type WatchSourceKind } from '@/queries/client';
import { qk } from '@/queries/keys';

interface PartyEnvelope {
  party: WatchPartySnapshot | null;
}

interface StartPartyInput {
  channelId: string;
  source: {
    kind: WatchSourceKind;
    url: string;
    title?: string | null;
  };
}

interface ControlInput {
  channelId: string;
  action: 'play' | 'pause' | 'seek';
  timeMs: number;
}

interface TransferInput {
  channelId: string;
  toUserId: string;
}

/**
 * Reads the current Watch Party for a channel, then subscribes to the
 * Socket.IO `channel:<id>:watch` room so server-side state changes (host
 * play/pause/seek/end) write straight into the cache.
 *
 * Components branch on `query.isLoading` / `query.data` to render the
 * source-picker empty state or the player. The realtime subscription only
 * runs once we know there's a channel id; it cleans up on unmount.
 */
export function useWatchParty(
  channelId: string | undefined,
): UseQueryResult<WatchPartySnapshot | null> {
  const qc = useQueryClient();
  const key = channelId ? qk.watch.byChannel(channelId) : qk.watch.root;

  const query = useQuery<WatchPartySnapshot | null>({
    queryKey: key,
    queryFn: async () => {
      const result = await api<PartyEnvelope>(`/watch/${channelId}`);
      return result.party;
    },
    enabled: Boolean(channelId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();

    const handle = (change: { channelId: string; snapshot: WatchPartySnapshot | null }) => {
      if (change.channelId !== channelId) return;
      qc.setQueryData<WatchPartySnapshot | null>(qk.watch.byChannel(channelId), change.snapshot);
    };

    socket.emit('watch:subscribe_channel', channelId, () => {
      // ack ignored — gateway only rejects malformed ids
    });
    socket.on('watch:state_changed', handle);

    return () => {
      socket.off('watch:state_changed', handle);
      socket.emit('watch:unsubscribe_channel', channelId);
    };
  }, [channelId, qc]);

  return query;
}

export function useStartWatchParty(): UseMutationResult<
  WatchPartySnapshot,
  Error,
  StartPartyInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, source }) => {
      const result = await api<PartyEnvelope>(`/watch/${channelId}/start`, {
        method: 'POST',
        body: { source },
      });
      if (!result.party) throw new Error('Server did not return a party snapshot');
      return result.party;
    },
    onSuccess: (party) => {
      qc.setQueryData<WatchPartySnapshot | null>(qk.watch.byChannel(party.channelId), party);
    },
  });
}

export function useStopWatchParty(): UseMutationResult<boolean, Error, { channelId: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId }) => {
      const result = await api<{ stopped: boolean }>(`/watch/${channelId}/stop`, {
        method: 'POST',
      });
      return result.stopped;
    },
    onSuccess: (_stopped, { channelId }) => {
      qc.setQueryData<WatchPartySnapshot | null>(qk.watch.byChannel(channelId), null);
    },
  });
}

export function useWatchControl(): UseMutationResult<WatchPartySnapshot, Error, ControlInput> {
  return useMutation({
    mutationFn: async ({ channelId, action, timeMs }) => {
      const result = await api<PartyEnvelope>(`/watch/${channelId}/control`, {
        method: 'POST',
        body: { action, timeMs },
      });
      if (!result.party) throw new Error('Server did not return a party snapshot');
      return result.party;
    },
  });
}

export function useTransferHost(): UseMutationResult<WatchPartySnapshot, Error, TransferInput> {
  return useMutation({
    mutationFn: async ({ channelId, toUserId }) => {
      const result = await api<PartyEnvelope>(`/watch/${channelId}/host`, {
        method: 'POST',
        body: { toUserId },
      });
      if (!result.party) throw new Error('Server did not return a party snapshot');
      return result.party;
    },
  });
}
