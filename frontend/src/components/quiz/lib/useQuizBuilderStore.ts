import { create } from 'zustand';

import type { QuizQuestion } from '@/types/quiz';

/**
 * Bridges the builder's local draft + selection into the right-rail preview.
 * Both surfaces live under `AppShellLayout` (main + rightRail slots) so they
 * can't share React state directly — Zustand is the project's pattern for
 * shared client state across sibling subtrees.
 *
 * The store mirrors only what the preview needs: which question is selected
 * and the latest draft questions for that quiz. The builder publishes on
 * every keystroke; the rail reads with `useShallow` to avoid infinite loops
 * (the questions array is a new reference per draft tick).
 */
interface QuizBuilderStore {
  quizId: string | null;
  selectedQuestionId: string | null;
  questions: QuizQuestion[];
  publish: (next: {
    quizId: string;
    selectedQuestionId: string | null;
    questions: QuizQuestion[];
  }) => void;
  setSelectedQuestionId: (id: string | null) => void;
  reset: () => void;
}

export const useQuizBuilderStore = create<QuizBuilderStore>((set) => ({
  quizId: null,
  selectedQuestionId: null,
  questions: [],
  publish: (next) =>
    set({
      quizId: next.quizId,
      selectedQuestionId: next.selectedQuestionId,
      questions: next.questions,
    }),
  setSelectedQuestionId: (id) => set({ selectedQuestionId: id }),
  reset: () => set({ quizId: null, selectedQuestionId: null, questions: [] }),
}));
