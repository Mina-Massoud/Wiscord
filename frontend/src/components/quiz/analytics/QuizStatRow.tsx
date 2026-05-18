import { quizGenZ } from '@/lib/copy/quiz-genz';
import type { QuizAnalyticsSnapshot } from '@/types/quiz';
import { StatCard } from './QuizStatRowStatCard';
import { AnimatedInt } from './QuizStatRowAnimatedInt';
import { AnimatedPercent } from './QuizStatRowAnimatedPercent';

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

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
