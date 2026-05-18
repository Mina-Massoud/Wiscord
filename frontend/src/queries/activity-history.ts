import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '@/queries/client';
import { qk } from '@/queries/keys';

/**
 * Shared snapshot history shape for both whiteboard and notes activities.
 * The endpoints differ in their URL prefix and underlying storage, but the
 * frontend treats them uniformly — one float button, one list, one set of
 * hooks parameterized by kind.
 */
export type HistoryKind = 'whiteboard' | 'notes';

export interface ActivitySnapshotSummary {
  id: string;
  title: string;
  savedBy: string;
  createdAt: string;
}

interface SnapshotListResponse {
  snapshots: ActivitySnapshotSummary[];
}

interface SnapshotEnvelope {
  snapshot: ActivitySnapshotSummary;
}

function pathFor(kind: HistoryKind, channelId: string, tail = ''): string {
  return `/${kind}/${channelId}/snapshots${tail}`;
}

export function useActivityHistory(
  kind: HistoryKind,
  channelId: string | undefined,
): UseQueryResult<ActivitySnapshotSummary[]> {
  return useQuery<ActivitySnapshotSummary[]>({
    queryKey: channelId
      ? qk.activityHistory.byKindChannel(kind, channelId)
      : qk.activityHistory.root,
    queryFn: async () => {
      const result = await api<SnapshotListResponse>(pathFor(kind, channelId!));
      return result.snapshots;
    },
    enabled: Boolean(channelId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

interface SaveInput {
  kind: HistoryKind;
  channelId: string;
  title?: string;
}

export function useSaveActivitySnapshot(): UseMutationResult<
  ActivitySnapshotSummary,
  Error,
  SaveInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, channelId, title }) => {
      const result = await api<SnapshotEnvelope>(pathFor(kind, channelId), {
        method: 'POST',
        body: title !== undefined ? { title } : {},
      });
      return result.snapshot;
    },
    onSuccess: (_snapshot, { kind, channelId }) => {
      void qc.invalidateQueries({
        queryKey: qk.activityHistory.byKindChannel(kind, channelId),
      });
    },
  });
}

interface LoadInput {
  kind: HistoryKind;
  channelId: string;
  snapshotId: string;
}

export function useLoadActivitySnapshot(): UseMutationResult<{ loaded: true }, Error, LoadInput> {
  return useMutation({
    mutationFn: async ({ kind, channelId, snapshotId }) => {
      return api<{ loaded: true }>(pathFor(kind, channelId, `/${snapshotId}/load`), {
        method: 'POST',
      });
    },
  });
}

interface DeleteInput {
  kind: HistoryKind;
  channelId: string;
  snapshotId: string;
}

export function useDeleteActivitySnapshot(): UseMutationResult<
  { deleted: true },
  Error,
  DeleteInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, channelId, snapshotId }) => {
      return api<{ deleted: true }>(pathFor(kind, channelId, `/${snapshotId}`), {
        method: 'DELETE',
      });
    },
    onSuccess: (_result, { kind, channelId }) => {
      void qc.invalidateQueries({
        queryKey: qk.activityHistory.byKindChannel(kind, channelId),
      });
    },
  });
}

interface ClearInput {
  kind: HistoryKind;
  channelId: string;
}

/**
 * Wipe the current scratch state for a kind. For whiteboard, drops the
 * live `TLSocketRoom` so connected clients reconnect to a blank canvas.
 * For notes, deletes the persisted Yjs row — connected clients see a
 * fresh empty doc on next reconnect.
 */
export function useClearActivityScratch(): UseMutationResult<{ cleared: true }, Error, ClearInput> {
  return useMutation({
    mutationFn: async ({ kind, channelId }) => {
      return api<{ cleared: true }>(`/${kind}/${channelId}`, { method: 'DELETE' });
    },
  });
}
