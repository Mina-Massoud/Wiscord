import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { useFinalizeAttempt, useStartAttempt, useSubmitAnswer } from '@/queries/quiz';
import type { QuizAttempt, RedactedQuiz } from '@/types/quiz';

import { QuizPlayerCard, type PlayerAnswerPayload } from './QuizPlayerCard';

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

function Progress({
  total,
  answered,
  current,
}: {
  total: number;
  answered: number;
  current: number;
}): React.JSX.Element {
  return (
    <div
      className="flex w-full max-w-2xl items-center gap-1.5"
      aria-label={`Progress: ${answered} of ${total} answered`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={
            i === current
              ? 'bg-blurple rounded-pill h-1.5 flex-1'
              : i < answered
                ? 'bg-blurple/60 rounded-pill h-1.5 flex-1'
                : 'bg-surface-active rounded-pill h-1.5 flex-1'
          }
        />
      ))}
    </div>
  );
}

function PlayerSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-6 px-6 py-10">
      <Skeleton className="h-4 w-40" />
      <div className="border-glass-border bg-glass-surface-1 flex w-full max-w-2xl flex-col gap-4 rounded-lg border p-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-3/4" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

function PlayerError({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-ink text-subhead font-semibold">Couldn&apos;t start the quiz.</p>
      <Button onClick={onRetry}>
        <Loader2 className="mr-2 size-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}

function PlayerComplete({
  attempt,
  totalQuestions,
}: {
  attempt: QuizAttempt;
  totalQuestions: number;
}): React.JSX.Element {
  const correct = attempt.answers.filter((a) => a.autoCorrect === true).length;
  const ungraded = attempt.answers.filter((a) => a.autoCorrect === null).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <span
        className="bg-success/15 flex size-16 items-center justify-center rounded-full"
        aria-hidden
      >
        <Trophy className="text-success size-8" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-ink text-subhead font-semibold">Submitted</h2>
        <p className="text-ink-muted text-caption">
          You answered {attempt.answers.length} of {totalQuestions}.
        </p>
      </div>
      <div className="bg-glass-surface-1 border-glass-border flex flex-col items-center gap-1 rounded-lg border px-8 py-5">
        <span className="text-ink text-display text-3xl font-bold">
          {correct} <span className="text-ink-muted text-subhead">/ {totalQuestions}</span>
        </span>
        <span className="text-ink-muted text-caption">
          Auto-graded so far
          {ungraded > 0 && ` · ${ungraded} short answer${ungraded === 1 ? '' : 's'} pending`}
        </span>
      </div>
      {ungraded > 0 && (
        <p className="text-ink-muted text-caption flex items-center gap-1.5">
          <CheckCircle2 className="size-4" aria-hidden />
          Your host will grade short answers — your final score updates after.
        </p>
      )}
    </div>
  );
}
