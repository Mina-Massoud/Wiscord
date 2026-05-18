import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { ListChecks, Loader2 } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

import { Button } from '@/components/ui/button';
import { PaneHeader } from '@/components/ui/pane-header';
import { Skeleton } from '@/components/ui/skeleton';

import { QuizAnalyticsDashboard } from '@/components/quiz/analytics/QuizAnalyticsDashboard';
import { QuizBuilder } from '@/components/quiz/QuizBuilder';
import { QuizLivePreview } from '@/components/quiz/QuizLivePreview';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { QuizSidebar } from '@/components/quiz/QuizSidebar';

import { useQuiz } from '@/queries/quiz';
import type { Quiz, QuizMode, QuizQuestion, RedactedQuiz } from '@/types/quiz';

/**
 * Dev-only quiz workshop mounted at `/app/labs/quiz/:channelId`.
 *
 * URL-driven state:
 *   - `:channelId`     — opaque uuid, sources the channel context until the
 *                        channels module ships
 *   - `?quiz=<id>`     — selected quiz; opens the builder (host) or results
 *                        (closed) or async player (open)
 *   - `?play=1`        — explicit player view (also auto for participants)
 *
 * When the channels module ships, this page is deleted and the inner panes
 * are mounted as a Quiz tab in the real channel page — no rewrites needed.
 */
export default function QuizLabPage(): React.JSX.Element {
  const { channelId } = useParams<{ channelId: string }>();
  const [search, setSearch] = useSearchParams();
  const quizId = search.get('quiz');
  const playFlag = search.get('play') === '1';

  const slug = useMemo(() => (channelId ? channelId.slice(-6) : ''), [channelId]);

  if (!channelId) {
    return (
      <FullPageMessage>
        <p className="text-ink-muted text-body">No channel id in URL.</p>
      </FullPageMessage>
    );
  }

  const handleSelectQuiz = (id: string): void => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      next.set('quiz', id);
      next.delete('play');
      return next;
    });
  };

  const handleLaunched = (mode: QuizMode): void => {
    if (mode === 'async') {
      // Host can take their own quiz once it's open. Bounce to the player.
      setSearch((prev) => {
        const next = new URLSearchParams(prev);
        next.set('play', '1');
        return next;
      });
    }
    // Live mode: stays on the builder for now. Live host-control overlay lands in PR2.
  };

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title={`Labs · Quiz · ${slug}`} />}
      serverRail={<ServerRail />}
      sidebar={
        <QuizSidebar
          channelId={channelId}
          channelSlug={slug}
          selectedQuizId={quizId}
          onSelect={handleSelectQuiz}
        />
      }
      userPanel={<GlobalUserPanel />}
      topBar={
        <PaneHeader
          variant="topbar"
          icon={<ListChecks className="text-ink-muted size-4 shrink-0" aria-hidden />}
          title="Quiz workshop"
          subtitle={<span title={`channel: ${channelId}`}>{slug}</span>}
        />
      }
      main={<QuizMainPane quizId={quizId} playFlag={playFlag} onLaunched={handleLaunched} />}
      rightRail={<QuizRightRail quizId={quizId} playFlag={playFlag} />}
    />
  );
}

interface QuizMainPaneProps {
  quizId: string | null;
  playFlag: boolean;
  onLaunched: (mode: QuizMode) => void;
}

/**
 * Decides between empty-state, builder, and player based on URL state and
 * the loaded quiz role. Per the failure-modes rule, all three async branches
 * (loading / error / empty) are rendered.
 */
function QuizMainPane({ quizId, playFlag, onLaunched }: QuizMainPaneProps): React.JSX.Element {
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

interface QuizRightRailProps {
  quizId: string | null;
  playFlag: boolean;
}

/**
 * Right rail: live preview while in the builder; otherwise the standard
 * Active Now panel so the rest of the shell still feels like Wiscord.
 */
function QuizRightRail({ quizId, playFlag }: QuizRightRailProps): React.JSX.Element {
  const detail = useQuiz(quizId ?? undefined);

  if (!quizId || detail.isLoading || detail.isError || !detail.data) {
    return <ActiveNowPanel />;
  }
  const { role, quiz } = detail.data;
  if (role !== 'host' || quiz.status !== 'draft' || playFlag) {
    return <ActiveNowPanel />;
  }

  // The builder owns selection state internally. We pick the first question
  // here as a "good enough" preview for PR1; lifting selection out of the
  // builder is a follow-up if/when the preview needs to mirror selection.
  const first = (quiz as Quiz).questions[0] ?? null;
  return (
    <QuizLivePreview
      question={first as QuizQuestion | null}
      questionNumber={first ? 1 : 0}
      totalQuestions={(quiz as Quiz).questions.length}
    />
  );
}

function EmptyMain(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <span
        aria-hidden
        className="bg-glass-surface-1 border-glass-border flex size-16 items-center justify-center rounded-full border"
      >
        <ListChecks className="text-ink-muted size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-ink text-subhead font-semibold">Build the channel&apos;s first quiz</h2>
        <p className="text-ink-muted text-caption">
          Pick or create one in the sidebar to get started.
        </p>
      </div>
    </div>
  );
}

function BuilderSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="border-glass-border w-quiz-list shrink-0 border-r p-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="mb-2 h-12 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    </div>
  );
}

function ErrorMain({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-ink text-body">Couldn&apos;t load this quiz.</p>
      <Button onClick={onRetry}>
        <Loader2 className="mr-2 size-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}

function FullPageMessage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="bg-canvas text-ink flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      {children}
    </div>
  );
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
