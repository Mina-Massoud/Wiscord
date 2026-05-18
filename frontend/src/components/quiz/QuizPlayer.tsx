import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { useFinalizeAttempt, useStartAttempt, useSubmitAnswer } from '@/queries/quiz';
import type { QuizAttempt, RedactedQuiz } from '@/types/quiz';

import { QuizPlayerCard, type PlayerAnswerPayload } from './QuizPlayerCard';
import { Progress } from './QuizPlayerProgress';
import { PlayerSkeleton } from './QuizPlayerPlayerSkeleton';
import { PlayerError } from './QuizPlayerPlayerError';
import { PlayerComplete } from './QuizPlayerPlayerComplete';

interface QuizPlayerProps {
  quiz: RedactedQuiz;
}

/**
 * Async-only player for PR1. Live mode lands in PR2 (it'll switch the
 * commit pattern from "store and advance" to "fire-and-forget per tap with
 * locking").
 *
 * Per the failure-modes rule, attempts are commit-per-question so a reload
 * mid-quiz restores progress.
 */
export function QuizPlayer({ quiz }: QuizPlayerProps): React.JSX.Element {
  const start = useStartAttempt(quiz.id);
  const submit = useSubmitAnswer(quiz.id);
  const finalize = useFinalizeAttempt(quiz.id);

  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [done, setDone] = useState(false);

  // Start (or recover) the attempt on mount. Idempotent on the server.
  useEffect(() => {
    let cancelled = false;
    setAttempt(null);
    setQuestionIndex(0);
    setDone(false);
    start.mutate(undefined, {
      onSuccess: (a) => {
        if (cancelled) return;
        setAttempt(a);
        if (a.submittedAt) setDone(true);
      },
      onError: (err) => {
        toast.error(err.message || "Couldn't start the quiz");
      },
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.id]);

  const totalQuestions = quiz.questions.length;
  const currentQuestion = quiz.questions[questionIndex] ?? null;

  const existingAnswer = useMemo(() => {
    if (!attempt || !currentQuestion) return null;
    return attempt.answers.find((a) => a.questionId === currentQuestion.id) ?? null;
  }, [attempt, currentQuestion]);

  if (start.isPending && !attempt) {
    return <PlayerSkeleton />;
  }

  if (!attempt || !currentQuestion) {
    return <PlayerError onRetry={() => start.mutate()} />;
  }

  if (done) {
    return <PlayerComplete attempt={attempt} totalQuestions={totalQuestions} />;
  }

  const isLast = questionIndex === totalQuestions - 1;

  const commitAndAdvance = async (payload: PlayerAnswerPayload): Promise<void> => {
    try {
      const next = await submit.mutateAsync({
        attemptId: attempt.id,
        questionId: currentQuestion.id,
        ...payload,
      });
      setAttempt(next);
    } catch (err) {
      toast.error((err as Error).message || "Couldn't record your answer. Try again.");
      throw err;
    }
  };

  const advance = async (): Promise<void> => {
    if (!isLast) {
      setQuestionIndex((i) => i + 1);
      return;
    }
    try {
      const submitted = await finalize.mutateAsync({ attemptId: attempt.id });
      setAttempt(submitted);
      setDone(true);
      toast.success('Submitted');
    } catch (err) {
      toast.error((err as Error).message || "Couldn't submit. Try again.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-6 overflow-y-auto px-6 py-10">
      <header className="flex w-full max-w-2xl flex-col items-center gap-1 text-center">
        <h1 className="text-ink text-subhead font-semibold">{quiz.title}</h1>
        <p className="text-ink-muted text-caption">
          {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'} ·{' '}
          {quiz.mode === 'async' ? 'No time limit' : 'Live'}
        </p>
      </header>

      <QuizPlayerCard
        question={currentQuestion}
        questionNumber={questionIndex + 1}
        totalQuestions={totalQuestions}
        existingAnswer={existingAnswer}
        onCommit={commitAndAdvance}
        onNext={() => void advance()}
        isLast={isLast}
        isSubmitting={submit.isPending || finalize.isPending}
      />

      <Progress total={totalQuestions} answered={attempt.answers.length} current={questionIndex} />
    </div>
  );
}
