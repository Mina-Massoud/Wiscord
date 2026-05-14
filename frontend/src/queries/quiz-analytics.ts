import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { api, getSocket } from '@/queries/client';
import { qk } from '@/queries/keys';
import type { QuizAnalyticsResponse, QuizAnalyticsSnapshot } from '@/types/quiz';

/**
 * Host-only live analytics for a quiz.
 *
 * Three-layer freshness:
 *   1. `useQuery` fetches the current snapshot from `GET /quiz/:id/analytics`
 *      so the dashboard renders immediately on mount.
 *   2. A Socket.IO subscription writes incoming `quiz:analytics_changed`
 *      payloads straight into the same query key — TanStack Query handles
 *      re-rendering for us, no Zustand bus.
 *   3. The socket subscribe handler on the server pushes a fresh snapshot as
 *      its first event, so even if the REST fetch is stale-cached we converge
 *      within one round trip.
 *
 * Cleanup is mandatory — every subscription unsubscribes on unmount and asks
 * the server to drop us from the room.
 */
export function useQuizAnalytics(
  quizId: string | undefined,
): UseQueryResult<QuizAnalyticsSnapshot | null> {
  const qc = useQueryClient();

  const query = useQuery<QuizAnalyticsSnapshot | null>({
    queryKey: quizId ? qk.quiz.analytics(quizId) : qk.quiz.root,
    queryFn: async () => {
      const res = await api<QuizAnalyticsResponse>(`/quiz/${quizId}/analytics`);
      return res.analytics;
    },
    enabled: Boolean(quizId),
    staleTime: 0,
  });

  useEffect(() => {
    if (!quizId) return undefined;
    const socket = getSocket();

    const onChanged = (snapshot: QuizAnalyticsSnapshot): void => {
      if (snapshot.quizId !== quizId) return;
      qc.setQueryData<QuizAnalyticsSnapshot | null>(qk.quiz.analytics(quizId), snapshot);
    };

    socket.on('quiz:analytics_changed', onChanged);

    const subscribe = (): void => {
      socket.emit('quiz:subscribe_host', quizId, () => {
        // Subscribe ack — server pushes the initial snapshot via the same
        // event, so there's nothing to do here on success. On failure (false)
        // we silently fall back to the REST fetch already in flight.
      });
    };

    if (socket.connected) {
      subscribe();
    } else {
      socket.once('connect', subscribe);
    }

    return () => {
      socket.off('quiz:analytics_changed', onChanged);
      socket.off('connect', subscribe);
      if (socket.connected) {
        socket.emit('quiz:unsubscribe_host', quizId);
      }
    };
  }, [quizId, qc]);

  return query;
}
