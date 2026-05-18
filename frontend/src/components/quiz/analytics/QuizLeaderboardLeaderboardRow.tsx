import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { cn } from '@/lib/cn';
import { quizGenZ } from '@/lib/copy/quiz-genz';
import type { QuizLeaderboardEntry } from '@/types/quiz';
import { RankBadge } from './QuizLeaderboardRankBadge';

interface LeaderboardRowProps {
  row: QuizLeaderboardEntry;
  rank: number;
  isMe: boolean;
}

export function LeaderboardRow({ row, rank, isMe }: LeaderboardRowProps): React.JSX.Element {
  const animatedScore = useAnimatedNumber(row.score);
  const pct = Math.round(animatedScore * 100);
  const literalPct = Math.round(row.score * 100);
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
      <span
        className="text-ink text-subhead shrink-0 font-semibold tabular-nums"
        aria-label={quizGenZ.leaderboard.scoreLine(literalPct)}
      >
        <span aria-hidden>{quizGenZ.leaderboard.scoreLine(pct)}</span>
      </span>
    </li>
  );
}
