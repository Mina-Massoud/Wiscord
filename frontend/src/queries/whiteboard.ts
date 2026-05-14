import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '@/queries/client';
import { qk } from '@/queries/keys';
import type { WhiteboardSnapshotResponse } from '@/types/whiteboard';

/**
 * Cold-start snapshot for a channel's whiteboard. Fetched once on page
 * mount and applied to the local tldraw store before the sync socket
 * opens — that way the canvas paints with the latest committed state
 * immediately instead of flashing empty for the WS round-trip.
 *
 * Live writes never go through this query; they ride the WebSocket at
 * `/sync/whiteboard/:channelId`. We intentionally set a long staleTime
 * because once the WS is connected, the in-memory store is the source
 * of truth — refetching the snapshot would clobber unsaved local edits.
 */
export function useWhiteboardSnapshot(
  channelId: string | undefined,
): UseQueryResult<WhiteboardSnapshotResponse> {
  return useQuery<WhiteboardSnapshotResponse>({
    queryKey: channelId ? qk.whiteboard.snapshot(channelId) : qk.whiteboard.root,
    queryFn: () =>
      api<WhiteboardSnapshotResponse>(`/whiteboard/${channelId}/snapshot`),
    enabled: Boolean(channelId),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Decode the base64 snapshot payload into the raw JSON string tldraw's
 * sync store expects. Returns null when the channel has no saved board.
 */
export function decodeSnapshotPayload(payload: WhiteboardSnapshotResponse): string | null {
  if (!payload.snapshot) return null;
  if (typeof window === 'undefined') return null;
  try {
    return window.atob(payload.snapshot);
  } catch {
    // Corrupt payload — render an empty canvas rather than crash. The
    // next edit will overwrite the persisted row server-side.
    return null;
  }
}

/**
 * Wipe a channel's whiteboard. Auth-gated server-side; the v1 affordance
 * lives behind an AlertDialog in the labs sidebar so a stray click can't
 * destroy work. After success we invalidate the snapshot query so any
 * mounted canvas re-fetches the (now empty) state on remount.
 */
export function useClearWhiteboard(
  channelId: string,
): UseMutationResult<{ cleared: true }, Error, void> {
  const queryClient = useQueryClient();
  return useMutation<{ cleared: true }, Error, void>({
    mutationFn: () =>
      api<{ cleared: true }>(`/whiteboard/${channelId}`, { method: 'DELETE' }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.whiteboard.byChannel(channelId),
      });
      void queryClient.invalidateQueries({
        queryKey: qk.whiteboard.snapshot(channelId),
      });
    },
  });
}
