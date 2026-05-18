import { useAutoAnimate } from '@formkit/auto-animate/react';
import { quizGenZ } from '@/lib/copy/quiz-genz';
import { useSession } from '@/queries/auth';
import type { QuizLeaderboardEntry } from '@/types/quiz';
import { LeaderboardRow } from './QuizLeaderboardLeaderboardRow';

interface QuizLeaderboardProps {
  rows: QuizLeaderboardEntry[];
}

/**
 * Sorted by score (desc), tiebreak earliest submission. `useAutoAnimate`
 * reorders rows smoothly as fresh socket events shift rankings.
 */
export function QuizLeaderboard({ rows }: QuizLeaderboardProps): React.JSX.Element {
  const session = useSession();
  const myId = session.data?.id;
  const [parent] = useAutoAnimate<HTMLOListElement>();

  if (rows.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
          {quizGenZ.leaderboard.title}
        </h2>
        <div className="bg-glass-callout border-glass-border text-ink-muted text-caption rounded-lg border p-4">
          {quizGenZ.leaderboard.empty}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
        {quizGenZ.leaderboard.title}
      </h2>
      <ol
        ref={parent}
        className="bg-glass-surface-1 border-glass-border flex flex-col rounded-lg border"
      >
        {rows.map((row, index) => (
          <LeaderboardRow key={row.userId} row={row} rank={index + 1} isMe={row.userId === myId} />
        ))}
      </ol>
    </section>
  );
}
