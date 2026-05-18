import type { QuizAttempt } from '@/types/quiz';
import { CheckCircle2, Trophy } from 'lucide-react';

export function PlayerComplete({
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
