import { Loader2, Radio } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { quizGenZ } from '@/lib/copy/quiz-genz';
import { cn } from '@/lib/cn';
import { useQuizAnalytics } from '@/queries/quiz-analytics';

import { QuizAnalyticsSkeleton } from './QuizAnalyticsSkeleton';
import { QuizCloseButton } from './QuizCloseButton';
import { QuizLeaderboard } from './QuizLeaderboard';
import { QuizQuestionBreakdown } from './QuizQuestionBreakdown';
import { QuizStatRow } from './QuizStatRow';

interface QuizAnalyticsDashboardProps {
  quizId: string;
  title: string;
}

/**
 * Live analytics dashboard. Renders for the host while a quiz is `live`,
 * `open`, or `closed`. Drafts have no analytics — the parent never mounts
 * this for a draft quiz.
 *
 * Three async branches per `frontend/CLAUDE.md`: loading skeleton, error
 * retry, populated. Data merges REST snapshot + socket events through the
 * `useQuizAnalytics` hook.
 */
export function QuizAnalyticsDashboard({
  quizId,
  title,
}: QuizAnalyticsDashboardProps): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useQuizAnalytics(quizId);

  if (isLoading && !data) return <QuizAnalyticsSkeleton />;

  if (isError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <p className="text-ink text-subhead font-semibold">{quizGenZ.error.title}</p>
        <p className="text-ink-muted text-caption max-w-xs">{quizGenZ.error.body}</p>
        <Button onClick={() => void refetch()}>
          <Loader2 className="mr-2 size-4" aria-hidden />
          {quizGenZ.error.retry}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <p className="text-ink text-subhead font-semibold">{quizGenZ.empty.title}</p>
        <p className="text-ink-muted text-caption max-w-md">{quizGenZ.empty.body}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={data.status} />
          <QuizCloseButton quizId={quizId} status={data.status} />
        </div>
        <h1 className="text-ink text-subhead truncate font-semibold">{title}</h1>
      </header>

      <QuizStatRow snapshot={data} />

      <QuizQuestionBreakdown rows={data.perQuestion} />

      <QuizLeaderboard rows={data.leaderboard} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const isLive = status === 'live';
  const isClosed = status === 'closed';
  const label = isLive ? quizGenZ.liveBadge : isClosed ? quizGenZ.closedBadge : status;
  return (
    <span
      className={cn(
        'text-badge rounded-pill inline-flex w-fit items-center gap-1.5 px-2 py-0.5 font-semibold tracking-wider uppercase',
        isLive && 'bg-destructive/15 text-destructive',
        isClosed && 'bg-ink-muted/15 text-ink-muted',
        !isLive && !isClosed && 'bg-blurple/15 text-blurple',
      )}
    >
      {isLive && <Radio className="size-3 animate-pulse" aria-hidden />}
      {label}
    </span>
  );
}
