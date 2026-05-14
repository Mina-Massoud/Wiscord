import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '@/queries/client';
import { qk } from '@/queries/keys';
import type {
  AttemptListResponse,
  AttemptResponse,
  Quiz,
  QuizAttempt,
  QuizDetailResponse,
  QuizListResponse,
  QuizMode,
  QuizMutationResponse,
  QuizQuestion,
  QuizSettings,
} from '@/types/quiz';

/**
 * REST hooks for the quiz module. One hook per endpoint; mutations invalidate
 * the keys they affect on settle, matching the rule from frontend/CLAUDE.md.
 *
 * Live-mode socket hooks are not in PR1 — they'll land alongside the live
 * player in the next slice.
 */

// ── Read ────────────────────────────────────────────────────────────────────

export function useChannelQuizzes(channelId: string | undefined): UseQueryResult<Quiz[]> {
  return useQuery<Quiz[]>({
    queryKey: channelId ? qk.quiz.byChannel(channelId) : qk.quiz.root,
    queryFn: async () => {
      const res = await api<QuizListResponse>('/quiz', { search: { channelId: channelId! } });
      return res.quizzes;
    },
    enabled: Boolean(channelId),
    staleTime: 30_000,
  });
}

/**
 * Every quiz the current user hosts, across all channels. Backs the labs
 * index page which groups quizzes by channelId.
 */
export function useMyQuizzes(): UseQueryResult<Quiz[]> {
  return useQuery<Quiz[]>({
    queryKey: qk.quiz.mine(),
    queryFn: async () => {
      const res = await api<QuizListResponse>('/quiz/mine');
      return res.quizzes;
    },
    staleTime: 30_000,
  });
}

export function useQuiz(quizId: string | undefined): UseQueryResult<QuizDetailResponse> {
  return useQuery<QuizDetailResponse>({
    queryKey: quizId ? qk.quiz.byId(quizId) : qk.quiz.root,
    queryFn: () => api<QuizDetailResponse>(`/quiz/${quizId}`),
    enabled: Boolean(quizId),
    staleTime: 5_000,
  });
}

export function useQuizAttempts(quizId: string | undefined): UseQueryResult<QuizAttempt[]> {
  return useQuery<QuizAttempt[]>({
    queryKey: quizId ? qk.quiz.attempts(quizId) : qk.quiz.root,
    queryFn: async () => {
      const res = await api<AttemptListResponse>(`/quiz/${quizId}/attempts`);
      return res.attempts;
    },
    enabled: Boolean(quizId),
    staleTime: 10_000,
  });
}

// ── Write (host) ────────────────────────────────────────────────────────────

export function useCreateQuiz(): UseMutationResult<
  Quiz,
  Error,
  { channelId: string; title: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await api<QuizMutationResponse>('/quiz', { method: 'POST', body });
      return res.quiz;
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: qk.quiz.byChannel(vars.channelId) });
    },
  });
}

export interface UpdateQuizPatch {
  title?: string;
  questions?: QuizQuestion[];
  settings?: Partial<QuizSettings>;
}

export function useUpdateQuiz(quizId: string): UseMutationResult<Quiz, Error, UpdateQuizPatch> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch) => {
      const res = await api<QuizMutationResponse>(`/quiz/${quizId}`, {
        method: 'PATCH',
        body: patch,
      });
      return res.quiz;
    },
    onSuccess: (quiz) => {
      // Optimistic-friendly: write the new shape into the detail key directly
      // so the editor doesn't flash on save.
      qc.setQueryData<QuizDetailResponse>(qk.quiz.byId(quizId), { role: 'host', quiz });
    },
    onSettled: (quiz) => {
      if (quiz) {
        void qc.invalidateQueries({ queryKey: qk.quiz.byChannel(quiz.channelId) });
      }
    },
  });
}

export function useDeleteQuiz(): UseMutationResult<
  void,
  Error,
  { quizId: string; channelId: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ quizId }) => {
      await api<{ deleted: true }>(`/quiz/${quizId}`, { method: 'DELETE' });
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: qk.quiz.byChannel(vars.channelId) });
      void qc.removeQueries({ queryKey: qk.quiz.byId(vars.quizId) });
    },
  });
}

export function useLaunchQuiz(quizId: string): UseMutationResult<Quiz, Error, { mode: QuizMode }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await api<QuizMutationResponse>(`/quiz/${quizId}/launch`, {
        method: 'POST',
        body,
      });
      return res.quiz;
    },
    onSettled: (quiz) => {
      void qc.invalidateQueries({ queryKey: qk.quiz.byId(quizId) });
      if (quiz) void qc.invalidateQueries({ queryKey: qk.quiz.byChannel(quiz.channelId) });
    },
  });
}

export function useCloseQuiz(quizId: string): UseMutationResult<Quiz, Error, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api<QuizMutationResponse>(`/quiz/${quizId}/close`, { method: 'POST' });
      return res.quiz;
    },
    onSettled: (quiz) => {
      void qc.invalidateQueries({ queryKey: qk.quiz.byId(quizId) });
      if (quiz) void qc.invalidateQueries({ queryKey: qk.quiz.byChannel(quiz.channelId) });
    },
  });
}

// ── Attempts (participant) ─────────────────────────────────────────────────

export function useStartAttempt(quizId: string): UseMutationResult<QuizAttempt, Error, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api<AttemptResponse>(`/quiz/${quizId}/attempts`, { method: 'POST' });
      return res.attempt;
    },
    onSuccess: (attempt) => {
      qc.setQueryData(qk.quiz.myAttempt(quizId), attempt);
    },
  });
}

export interface SubmitAnswerArgs {
  attemptId: string;
  questionId: string;
  selectedOptionIds?: string[];
  selectedBool?: boolean;
  text?: string;
}

export function useSubmitAnswer(
  quizId: string,
): UseMutationResult<QuizAttempt, Error, SubmitAnswerArgs> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ attemptId, ...answer }) => {
      const res = await api<AttemptResponse>(`/quiz/${quizId}/attempts/${attemptId}`, {
        method: 'PATCH',
        body: answer,
      });
      return res.attempt;
    },
    onSuccess: (attempt) => {
      qc.setQueryData(qk.quiz.myAttempt(quizId), attempt);
    },
  });
}

export function useFinalizeAttempt(
  quizId: string,
): UseMutationResult<QuizAttempt, Error, { attemptId: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ attemptId }) => {
      const res = await api<AttemptResponse>(`/quiz/${quizId}/attempts/${attemptId}/submit`, {
        method: 'POST',
      });
      return res.attempt;
    },
    onSuccess: (attempt) => {
      qc.setQueryData(qk.quiz.myAttempt(quizId), attempt);
      void qc.invalidateQueries({ queryKey: qk.quiz.attempts(quizId) });
    },
  });
}

export function useGradeShortAnswer(
  quizId: string,
): UseMutationResult<
  QuizAttempt,
  Error,
  { attemptId: string; questionId: string; isCorrect: boolean }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ attemptId, questionId, isCorrect }) => {
      const res = await api<AttemptResponse>(`/quiz/${quizId}/attempts/${attemptId}/grade`, {
        method: 'PATCH',
        body: { questionId, isCorrect },
      });
      return res.attempt;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.quiz.attempts(quizId) });
    },
  });
}
