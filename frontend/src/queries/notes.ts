import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '@/queries/client';
import { qk } from '@/queries/keys';
import type { NotesListResponse } from '@/types/notes';

/**
 * Notes docs the caller was most recently the editor on. Drives the labs
 * index at `/app/labs/notes`. Short staleTime — the index cares about
 * freshness so a doc the user just edited jumps to the top on revisit.
 *
 * Live writes never go through this query; they ride the Yjs WebSocket
 * at `/sync/notes/:channelId`. This list is purely the "show me my docs"
 * read after restart / first paint.
 */
export function useMyNotes(): UseQueryResult<NotesListResponse> {
  return useQuery<NotesListResponse>({
    queryKey: qk.notes.mine(),
    queryFn: () => api<NotesListResponse>('/notes/mine'),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Wipe a channel's notes doc. Auth-gated server-side; the v1 affordance
 * lives behind an AlertDialog in the labs sidebar so a stray click can't
 * destroy work. After success we invalidate the index so the deleted row
 * disappears immediately.
 */
export function useClearNotes(
  channelId: string,
): UseMutationResult<{ cleared: true }, Error, void> {
  const queryClient = useQueryClient();
  return useMutation<{ cleared: true }, Error, void>({
    mutationFn: () => api<{ cleared: true }>(`/notes/${channelId}`, { method: 'DELETE' }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notes.mine() });
      void queryClient.invalidateQueries({ queryKey: qk.notes.byChannel(channelId) });
    },
  });
}
