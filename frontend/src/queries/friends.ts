import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  api,
  ApiError,
  getSocket,
  type FriendDto,
  type FriendRemovedEvent,
  type FriendRequestDto,
  type FriendRequestIncomingEvent,
  type FriendRequestRespondedEvent,
} from '@/queries/client';
import { qk } from '@/queries/keys';

interface FriendsEnvelope {
  friends: FriendDto[];
}
interface RequestsEnvelope {
  requests: FriendRequestDto[];
}
interface RequestEnvelope {
  request: FriendRequestDto;
}
interface SearchEnvelope {
  users: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>;
}

// ── Reads ────────────────────────────────────────────────────────────────

export function useFriends(): UseQueryResult<FriendDto[]> {
  return useQuery<FriendDto[]>({
    queryKey: qk.friends.list(),
    queryFn: async () => {
      const result = await api<FriendsEnvelope>('/friends');
      return result.friends;
    },
  });
}

export function useIncomingFriendRequests(): UseQueryResult<FriendRequestDto[]> {
  return useQuery<FriendRequestDto[]>({
    queryKey: qk.friends.incoming(),
    queryFn: async () => {
      const result = await api<RequestsEnvelope>('/friends/requests/incoming');
      return result.requests;
    },
  });
}

export function useOutgoingFriendRequests(): UseQueryResult<FriendRequestDto[]> {
  return useQuery<FriendRequestDto[]>({
    queryKey: qk.friends.outgoing(),
    queryFn: async () => {
      const result = await api<RequestsEnvelope>('/friends/requests/outgoing');
      return result.requests;
    },
  });
}

/**
 * Username-prefix search for the Add Friend tab. Enabled-gated on `q.length >= 2`
 * so we don't fire a request on every keystroke; consumers should debounce
 * before passing `q` in.
 */
export function useSearchUsers(q: string): UseQueryResult<SearchEnvelope['users']> {
  return useQuery<SearchEnvelope['users']>({
    queryKey: qk.friends.search(q),
    queryFn: async () => {
      const result = await api<SearchEnvelope>('/friends/search', { search: { q } });
      return result.users;
    },
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────

export function useSendFriendRequest(): UseMutationResult<
  FriendRequestDto,
  ApiError,
  { username: string }
> {
  const qc = useQueryClient();
  return useMutation<FriendRequestDto, ApiError, { username: string }>({
    mutationFn: async ({ username }) => {
      const result = await api<RequestEnvelope>('/friends/requests', {
        method: 'POST',
        body: { username },
      });
      return result.request;
    },
    onSuccess: () => {
      // Refetch outgoing so the new pending row appears.
      // If the server auto-accepted (status === 'accepted'), the friends list
      // also needs to refresh on this side.
      void qc.invalidateQueries({ queryKey: qk.friends.outgoing() });
      void qc.invalidateQueries({ queryKey: qk.friends.list() });
    },
  });
}

export function useAcceptFriendRequest(): UseMutationResult<
  FriendRequestDto,
  ApiError,
  { requestId: string }
> {
  const qc = useQueryClient();
  return useMutation<FriendRequestDto, ApiError, { requestId: string }>({
    mutationFn: async ({ requestId }) => {
      const result = await api<RequestEnvelope>(`/friends/requests/${requestId}/accept`, {
        method: 'POST',
      });
      return result.request;
    },
    onMutate: async ({ requestId }) => {
      await qc.cancelQueries({ queryKey: qk.friends.incoming() });
      const previous = qc.getQueryData<FriendRequestDto[]>(qk.friends.incoming());
      qc.setQueryData<FriendRequestDto[]>(qk.friends.incoming(), (rows) =>
        (rows ?? []).filter((r) => r.id !== requestId),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const previous = (ctx as { previous?: FriendRequestDto[] } | undefined)?.previous;
      if (previous) qc.setQueryData(qk.friends.incoming(), previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.friends.list() });
      void qc.invalidateQueries({ queryKey: qk.friends.incoming() });
    },
  });
}

export function useDeclineFriendRequest(): UseMutationResult<
  { id: string },
  ApiError,
  { requestId: string }
> {
  const qc = useQueryClient();
  return useMutation<{ id: string }, ApiError, { requestId: string }>({
    mutationFn: async ({ requestId }) => {
      return await api<{ id: string }>(`/friends/requests/${requestId}/decline`, {
        method: 'POST',
      });
    },
    onMutate: async ({ requestId }) => {
      await qc.cancelQueries({ queryKey: qk.friends.incoming() });
      const previous = qc.getQueryData<FriendRequestDto[]>(qk.friends.incoming());
      qc.setQueryData<FriendRequestDto[]>(qk.friends.incoming(), (rows) =>
        (rows ?? []).filter((r) => r.id !== requestId),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const previous = (ctx as { previous?: FriendRequestDto[] } | undefined)?.previous;
      if (previous) qc.setQueryData(qk.friends.incoming(), previous);
    },
  });
}

export function useCancelFriendRequest(): UseMutationResult<
  { id: string },
  ApiError,
  { requestId: string }
> {
  const qc = useQueryClient();
  return useMutation<{ id: string }, ApiError, { requestId: string }>({
    mutationFn: async ({ requestId }) => {
      return await api<{ id: string }>(`/friends/requests/${requestId}`, { method: 'DELETE' });
    },
    onMutate: async ({ requestId }) => {
      await qc.cancelQueries({ queryKey: qk.friends.outgoing() });
      const previous = qc.getQueryData<FriendRequestDto[]>(qk.friends.outgoing());
      qc.setQueryData<FriendRequestDto[]>(qk.friends.outgoing(), (rows) =>
        (rows ?? []).filter((r) => r.id !== requestId),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const previous = (ctx as { previous?: FriendRequestDto[] } | undefined)?.previous;
      if (previous) qc.setQueryData(qk.friends.outgoing(), previous);
    },
  });
}

export function useRemoveFriend(): UseMutationResult<
  { removed: boolean },
  ApiError,
  { userId: string }
> {
  const qc = useQueryClient();
  return useMutation<{ removed: boolean }, ApiError, { userId: string }>({
    mutationFn: async ({ userId }) => {
      return await api<{ removed: boolean }>(`/friends/${userId}`, { method: 'DELETE' });
    },
    onMutate: async ({ userId }) => {
      await qc.cancelQueries({ queryKey: qk.friends.list() });
      const previous = qc.getQueryData<FriendDto[]>(qk.friends.list());
      qc.setQueryData<FriendDto[]>(qk.friends.list(), (rows) =>
        (rows ?? []).filter((f) => f.user.id !== userId),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const previous = (ctx as { previous?: FriendDto[] } | undefined)?.previous;
      if (previous) qc.setQueryData(qk.friends.list(), previous);
    },
  });
}

// ── Realtime ──────────────────────────────────────────────────────────────

/**
 * Subscribe once at the page level. Every server-side friend event lands here
 * and invalidates the relevant TanStack Query keys. The cache is the single
 * source of truth — feature components just read from it.
 *
 * Mount in `FriendsPage` only (or anywhere else friends data is visible).
 */
export function useFriendRealtime(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onIncoming = (_event: FriendRequestIncomingEvent) => {
      void qc.invalidateQueries({ queryKey: qk.friends.incoming() });
    };
    const onAccepted = (_event: FriendRequestRespondedEvent) => {
      void qc.invalidateQueries({ queryKey: qk.friends.outgoing() });
      void qc.invalidateQueries({ queryKey: qk.friends.list() });
    };
    const onDeclined = (_event: FriendRequestRespondedEvent) => {
      void qc.invalidateQueries({ queryKey: qk.friends.outgoing() });
    };
    const onCancelled = (_event: FriendRequestRespondedEvent) => {
      void qc.invalidateQueries({ queryKey: qk.friends.incoming() });
    };
    const onRemoved = (_event: FriendRemovedEvent) => {
      void qc.invalidateQueries({ queryKey: qk.friends.list() });
    };

    socket.on('friend_request:incoming', onIncoming);
    socket.on('friend_request:accepted', onAccepted);
    socket.on('friend_request:declined', onDeclined);
    socket.on('friend_request:cancelled', onCancelled);
    socket.on('friend:removed', onRemoved);

    return () => {
      socket.off('friend_request:incoming', onIncoming);
      socket.off('friend_request:accepted', onAccepted);
      socket.off('friend_request:declined', onDeclined);
      socket.off('friend_request:cancelled', onCancelled);
      socket.off('friend:removed', onRemoved);
    };
  }, [qc]);
}
