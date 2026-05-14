import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Crown } from 'lucide-react';

import { quizGenZ } from '@/lib/copy/quiz-genz';
import { cn } from '@/lib/cn';
import { useSession } from '@/queries/auth';
import type { QuizLeaderboardEntry } from '@/types/quiz';

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

interface LeaderboardRowProps {
  row: QuizLeaderboardEntry;
  rank: number;
  isMe: boolean;
}

function LeaderboardRow({ row, rank, isMe }: LeaderboardRowProps): React.JSX.Element {
  const pct = Math.round(row.score * 100);
  return (
    <li
      className={cn(
        'border-glass-border flex items-center gap-3 border-b px-4 py-3 last:border-b-0',
        isMe && 'bg-blurple/10',
      )}
    >
      <RankBadge rank={rank} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink text-control flex items-center gap-1.5 truncate font-medium">
          <span className="min-w-0 truncate">{row.displayName}</span>
          {isMe && (
            <span className="bg-blurple/15 text-blurple text-badge rounded-pill px-1.5 py-0.5 font-semibold">
              {quizGenZ.leaderboard.youTag}
            </span>
          )}
        </span>
        <span className="text-ink-muted text-caption truncate">
          {row.submittedAt
            ? quizGenZ.leaderboard.submittedAtRel(row.submittedAt)
            : quizGenZ.leaderboard.pending}
        </span>
      </div>
      <span className="text-ink text-subhead shrink-0 font-semibold tabular-nums">
        {quizGenZ.leaderboard.scoreLine(pct)}
      </span>
    </li>
  );
}

function RankBadge({ rank }: { rank: number }): React.JSX.Element {
  if (rank === 1) {
    return (
      <span
        className="bg-warning/15 text-warning rounded-pill flex size-7 shrink-0 items-center justify-center"
        aria-label="First place"
      >
        <Crown className="size-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'text-badge rounded-pill flex size-7 shrink-0 items-center justify-center font-semibold',
        rank === 2 && 'bg-ink-muted/20 text-ink',
        rank === 3 && 'bg-warning/10 text-warning',
        rank > 3 && 'bg-glass-callout text-ink-muted',
      )}
    >
      {rank}
    </span>
  );
}
