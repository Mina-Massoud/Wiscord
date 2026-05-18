import { usePinQuiz } from '@/queries/voice-activity';
import { useQuiz } from '@/queries/quiz';
import { toast } from '@/lib/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { QuizBuilder } from '@/components/quiz/QuizBuilder';
import type { Quiz, RedactedQuiz } from '@/types/quiz';
import { QuizAnalyticsDashboard } from '@/components/quiz/analytics/QuizAnalyticsDashboard';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { WaitingForHost } from './QuizActivityEmbedWaitingForHost';

interface PinnedQuizViewProps {
  channelId: string;
  quizId: string;
  isHost: boolean;
  hostDisplayName: string;
}

export function PinnedQuizView({
  channelId,
  quizId,
  isHost,
  hostDisplayName,
}: PinnedQuizViewProps): React.JSX.Element {
  const pin = usePinQuiz();
  const detail = useQuiz(quizId);

  const handleUnpin = (): void => {
    pin.mutate(
      { channelId, quizId: null },
      { onError: (err) => toast.error(err.message || "Couldn't unpin") },
    );
  };

  if (detail.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Error / empty response. The host needs an actionable retry (they own
  // the session and can re-pin / re-launch); a participant just sees
  // "host is preparing" — they can't do anything from a retry button and
  // a harsh error reads as "the activity is broken" when really the host
  // is still drafting (the backend redacts draft quizzes from non-hosts,
  // so a 404/403 here is the normal pre-launch state for participants).
  if (detail.isError || !detail.data) {
    if (!isHost) {
      return <WaitingForHost hostDisplayName={hostDisplayName} />;
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-ink text-body">Couldn&apos;t load this quiz.</p>
        <Button onClick={() => detail.refetch()}>Try again</Button>
      </div>
    );
  }

  const { role, quiz } = detail.data;

  // Host on a draft → builder, with a back-to-picker affordance.
  if (role === 'host' && quiz.status === 'draft') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-glass-border flex shrink-0 items-center gap-2 border-b px-4 py-2">
          <Button variant="ghost" size="sm" onClick={handleUnpin}>
            ← Pick a different quiz
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <QuizBuilder quiz={quiz as Quiz} onLaunched={() => undefined} />
        </div>
      </div>
    );
  }

  // Host on live/open/closed → analytics.
  if (role === 'host') {
    const hostQuiz = quiz as Quiz;
    return <QuizAnalyticsDashboard quizId={hostQuiz.id} title={hostQuiz.title} />;
  }

  // Participant on draft → waiting state. Host is building.
  if (quiz.status === 'draft') {
    return (
      <WaitingForHost hostDisplayName={hostDisplayName} questionCount={quiz.questions.length} />
    );
  }

  // Participant on any non-draft → player.
  return <QuizPlayer quiz={detail.data.quiz as RedactedQuiz} />;
}
