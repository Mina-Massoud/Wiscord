import { useQuiz } from '@/queries/quiz';
import { QuizBuilder } from '@/components/quiz/QuizBuilder';
import type { Quiz, QuizMode, RedactedQuiz } from '@/types/quiz';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { QuizAnalyticsDashboard } from '@/components/quiz/analytics/QuizAnalyticsDashboard';
import { BuilderSkeleton } from './QuizLabPageBuilderSkeleton';
import { EmptyMain } from './QuizLabPageEmptyMain';
import { ErrorMain } from './QuizLabPageErrorMain';

interface QuizMainPaneProps {
  quizId: string | null;
  playFlag: boolean;
  onLaunched: (mode: QuizMode) => void;
}

/**
 * Cheap host-side redaction so the host can play their own open quiz
 * without the answer keys bleeding through to the player UI. The server
 * still serves the un-redacted shape — this is purely a cosmetic strip.
 * For real participants, the server-redacted payload is already what they
 * receive (the API call returns role:'participant').
 */
function asRedacted(quiz: Quiz): RedactedQuiz {
  return {
    id: quiz.id,
    channelId: quiz.channelId,
    hostUserId: quiz.hostUserId,
    title: quiz.title,
    status: quiz.status,
    mode: quiz.mode,
    settings: quiz.settings,
    questions: quiz.questions.map((q) => {
      if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
        return {
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
        };
      }
      if (q.type === 'true_false') return { id: q.id, type: 'true_false', prompt: q.prompt };
      return { id: q.id, type: 'short', prompt: q.prompt };
    }),
  };
}

/**
 * Decides between empty-state, builder, and player based on URL state and
 * the loaded quiz role. Per the failure-modes rule, all three async branches
 * (loading / error / empty) are rendered.
 */
export function QuizMainPane({
  quizId,
  playFlag,
  onLaunched,
}: QuizMainPaneProps): React.JSX.Element {
  const detail = useQuiz(quizId ?? undefined);

  if (!quizId) return <EmptyMain />;
  if (detail.isLoading) return <BuilderSkeleton />;
  if (detail.isError || !detail.data) return <ErrorMain onRetry={() => detail.refetch()} />;

  const { role, quiz } = detail.data;

  // Host on a draft → builder. Host on open/live/closed → player (so they can take it).
  // Participant on any non-draft → player.
  if (role === 'host' && quiz.status === 'draft' && !playFlag) {
    return <QuizBuilder quiz={quiz as Quiz} onLaunched={onLaunched} />;
  }

  if (role === 'host' && (quiz.status === 'open' || quiz.status === 'live') && playFlag) {
    return <QuizPlayer quiz={asRedacted(quiz as Quiz)} />;
  }

  if (role === 'host') {
    // Host on a live, open, or closed quiz: realtime analytics dashboard.
    const hostQuiz = quiz as Quiz;
    return <QuizAnalyticsDashboard quizId={hostQuiz.id} title={hostQuiz.title} />;
  }

  // Participant view
  return <QuizPlayer quiz={detail.data.quiz} />;
}
