import { useShallow } from 'zustand/react/shallow';

import { useQuiz } from '@/queries/quiz';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';
import type { Quiz } from '@/types/quiz';
import { QuizLivePreview } from '@/components/quiz/QuizLivePreview';
import { useQuizBuilderStore } from '@/components/quiz/lib/useQuizBuilderStore';

interface QuizRightRailProps {
  quizId: string | null;
  playFlag: boolean;
}

/**
 * Right rail: live preview while in the builder; otherwise the standard
 * Active Now panel so the rest of the shell still feels like Wiscord.
 *
 * Mirrors the builder's selection and live draft via `useQuizBuilderStore`
 * so every keystroke is reflected here. Falls back to the server quiz +
 * first question when the store hasn't been populated yet (first paint
 * before the builder mounts its publish effect).
 */
export function QuizRightRail({ quizId, playFlag }: QuizRightRailProps): React.JSX.Element {
  const detail = useQuiz(quizId ?? undefined);

  const { storeQuizId, selectedQuestionId, draftQuestions } = useQuizBuilderStore(
    useShallow((s) => ({
      storeQuizId: s.quizId,
      selectedQuestionId: s.selectedQuestionId,
      draftQuestions: s.questions,
    })),
  );

  if (!quizId || detail.isLoading || detail.isError || !detail.data) {
    return <ActiveNowPanel />;
  }
  const { role, quiz } = detail.data;
  if (role !== 'host' || quiz.status !== 'draft' || playFlag) {
    return <ActiveNowPanel />;
  }

  const serverQuestions = (quiz as Quiz).questions;
  const storeMatches = storeQuizId === quizId;
  const questions = storeMatches ? draftQuestions : serverQuestions;
  const selectedId = storeMatches ? selectedQuestionId : (serverQuestions[0]?.id ?? null);

  const idx = selectedId ? questions.findIndex((q) => q.id === selectedId) : -1;
  const question = idx >= 0 ? (questions[idx] ?? null) : (questions[0] ?? null);
  const questionNumber = question ? (idx >= 0 ? idx + 1 : 1) : 0;

  return (
    <QuizLivePreview
      question={question}
      questionNumber={questionNumber}
      totalQuestions={questions.length}
    />
  );
}
