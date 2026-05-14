import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { quizGenZ } from '@/lib/copy/quiz-genz';
import type { QuizAnalyticsSnapshot } from '@/types/quiz';

interface QuizStatRowProps {
  snapshot: QuizAnalyticsSnapshot;
}

/**
 * Four headline metrics with Gen Z micro-copy. Numbers come from the server;
 * the slang sits underneath as a sub-label so the literal value is always
 * present for screen readers and quick scanning.
 */
export function QuizStatRow({ snapshot }: QuizStatRowProps): React.JSX.Element {
  return (
    <div
      role="list"
      aria-label="Quiz statistics"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <StatCard
        label={quizGenZ.participants.label}
        value={<AnimatedInt value={snapshot.participantCount} />}
        ariaValue={String(snapshot.participantCount)}
        detail={quizGenZ.participants.detail(snapshot.participantCount)}
      />
      <StatCard
        label={quizGenZ.submitted.label}
        value={
          <>
            <AnimatedInt value={snapshot.submittedCount} />
            <span aria-hidden>/</span>
            <AnimatedInt value={snapshot.participantCount} />
          </>
        }
        ariaValue={`${snapshot.submittedCount}/${snapshot.participantCount}`}
        detail={quizGenZ.submitted.detail(snapshot.submittedCount, snapshot.participantCount)}
      />
      <StatCard
        label={quizGenZ.averageScore.label}
        value={<AnimatedPercent value={snapshot.averageScore} />}
        ariaValue={formatPercent(snapshot.averageScore)}
        detail={quizGenZ.averageScore.detail(snapshot.averageScore, snapshot.submittedCount)}
      />
      <StatCard
        label={quizGenZ.accuracy.label}
        value={<AnimatedPercent value={snapshot.accuracy} />}
        ariaValue={formatPercent(snapshot.accuracy)}
        detail={quizGenZ.accuracy.detail(snapshot.accuracy)}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  ariaValue: string;
  detail: string;
}

function StatCard({ label, value, ariaValue, detail }: StatCardProps): React.JSX.Element {
  return (
    <div
      role="listitem"
      className="bg-glass-surface-1 border-glass-border flex flex-col gap-1 rounded-lg border p-4"
    >
      <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span
        className="text-ink text-display text-3xl leading-none font-bold tabular-nums"
        aria-label={ariaValue}
      >
        {value}
      </span>
      <span className="text-ink-muted text-caption">{detail}</span>
    </div>
  );
}

function AnimatedInt({ value }: { value: number }): React.JSX.Element {
  const animated = useAnimatedNumber(value);
  return <span aria-hidden>{Math.round(animated)}</span>;
}

function AnimatedPercent({ value }: { value: number }): React.JSX.Element {
  const animated = useAnimatedNumber(value);
  return <span aria-hidden>{Math.round(animated * 100)}%</span>;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
