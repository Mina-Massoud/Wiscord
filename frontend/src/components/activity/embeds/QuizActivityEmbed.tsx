import { ListChecks, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { findActivity } from '@/components/activity/ActivityRegistry';
import { usePinQuiz } from '@/queries/voice-activity';
import { useChannelQuizzes, useCreateQuiz, useQuiz } from '@/queries/quiz';
import { QuizAnalyticsDashboard } from '@/components/quiz/analytics/QuizAnalyticsDashboard';
import { QuizBuilder } from '@/components/quiz/QuizBuilder';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import type { Quiz, RedactedQuiz } from '@/types/quiz';

interface QuizActivityEmbedProps {
  channelId: string;
  /** Currently-pinned quiz id, broadcast to everyone in voice. Null = picker. */
  pinnedQuizId: string | null;
  hostDisplayName: string;
  isHost: boolean;
  onEndActivity: () => void;
}

/**
 * Quiz activity embed. The host picks (or builds) a quiz for the channel;
 * the picked quiz id is stored in the activity doc so every voice
 * participant sees the same quiz. Roles:
 *  - Host on a draft  → builder
 *  - Host on a live/open/closed → analytics dashboard
 *  - Participant on any non-draft → player
 *  - Participant on a draft → "host is preparing" empty state
 */
export function QuizActivityEmbed({
  channelId,
  pinnedQuizId,
  hostDisplayName,
  isHost,
  onEndActivity,
}: QuizActivityEmbedProps): React.JSX.Element {
  const definition = findActivity('quiz');
  if (!definition) throw new Error('Quiz activity not in registry');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActivityHeader
        icon={definition.icon}
        title={definition.title}
        hostDisplayName={hostDisplayName}
        isHost={isHost}
        isHostLed
        onLeaveActivity={onEndActivity}
      />
      <div className="flex min-h-0 flex-1">
        {pinnedQuizId ? (
          <PinnedQuizView
            channelId={channelId}
            quizId={pinnedQuizId}
            isHost={isHost}
            hostDisplayName={hostDisplayName}
          />
        ) : isHost ? (
          <HostQuizPicker channelId={channelId} />
        ) : (
          <WaitingForHost hostDisplayName={hostDisplayName} />
        )}
      </div>
    </div>
  );
}

interface HostQuizPickerProps {
  channelId: string;
}

function HostQuizPicker({ channelId }: HostQuizPickerProps): React.JSX.Element {
  const list = useChannelQuizzes(channelId);
  const create = useCreateQuiz();
  const pin = usePinQuiz();

  const handleCreate = (): void => {
    create.mutate(
      { channelId, title: 'Untitled quiz' },
      {
        onSuccess: (quiz) => {
          pin.mutate({ channelId, quizId: quiz.id });
        },
        onError: (err) => toast.error(err.message || "Couldn't create draft"),
      },
    );
  };

  const handlePick = (quizId: string): void => {
    pin.mutate(
      { channelId, quizId },
      { onError: (err) => toast.error(err.message || "Couldn't pin that quiz") },
    );
  };

  if (list.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-ink text-body">Couldn&apos;t load this channel&apos;s quizzes.</p>
        <Button onClick={() => list.refetch()}>Try again</Button>
      </div>
    );
  }

  const quizzes = list.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-ink text-subhead font-semibold">Pick a quiz to run</h2>
          <p className="text-ink-muted text-caption">Everyone in voice will see the same quiz.</p>
        </div>
        <Button onClick={handleCreate} disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'New quiz'}
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <div className="border-glass-border bg-glass-surface-1 flex flex-col items-center gap-2 rounded-lg border p-8 text-center">
          <ListChecks className="text-ink-muted size-7" aria-hidden />
          <p className="text-ink text-body font-semibold">No quizzes in this channel yet.</p>
          <p className="text-ink-muted text-caption">Create one above to get started.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {quizzes.map((quiz) => (
            <li key={quiz.id}>
              <button
                type="button"
                onClick={() => handlePick(quiz.id)}
                disabled={pin.isPending}
                className={cn(
                  'group bg-glass-surface-1 border-glass-border hover:border-glass-border-strong focus-visible:ring-blurple duration-fast flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                )}
              >
                <ListChecks className="text-ink-muted mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-ink text-tab truncate font-semibold">
                    {quiz.title || 'Untitled'}
                  </span>
                  <span className="text-ink-subtle text-badge">
                    {quiz.status} · {quiz.questions.length}{' '}
                    {quiz.questions.length === 1 ? 'question' : 'questions'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PinnedQuizViewProps {
  channelId: string;
  quizId: string;
  isHost: boolean;
  hostDisplayName: string;
}

function PinnedQuizView({
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

interface WaitingForHostProps {
  hostDisplayName: string;
  /** Optional — when we know the draft's question count, show progress copy. */
  questionCount?: number;
}

/**
 * Participant-facing waiting state while the host is still drafting the
 * quiz. Voice-channel Gen Z energy: a personal "X is cooking" line, a
 * pulsing icon stack (ListChecks card + Pencil overlay reads as
 * "list-is-being-authored"), and a three-dot bouncing progress beat.
 *
 * The icon stays literal per the CLAUDE.md rule — no sparkles or magic
 * glyphs even though the surface feels "AI-shaped" with the animation;
 * the activity is purely a quiz, not an AI surface.
 */
function WaitingForHost({
  hostDisplayName,
  questionCount,
}: WaitingForHostProps): React.JSX.Element {
  const phrases = [
    'No peeking until the quiz drops.',
    'Stretch — questions are loading.',
    'It’s gonna hit different.',
  ];
  // Rotate the phrase based on the question count when available so the
  // copy feels alive as the host works; otherwise stay on the first line.
  const phraseIndex =
    typeof questionCount === 'number' ? Math.min(questionCount, phrases.length - 1) : 0;
  const phrase = phrases[phraseIndex] ?? phrases[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative">
        <span className="bg-glass-surface-1 border-glass-border ease-wiscord duration-base flex size-24 items-center justify-center rounded-2xl border">
          <ListChecks className="text-ink-muted size-10" strokeWidth={1.5} aria-hidden />
        </span>
        <span
          className="bg-blurple ring-glass-surface-2 absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full ring-2"
          aria-hidden
        >
          <Pencil className="size-3.5 animate-pulse text-white" strokeWidth={2.5} />
        </span>
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-ink text-subhead font-semibold">
          {hostDisplayName} is cooking up a quiz.
        </h2>
        <p className="text-ink-muted text-control">{phrase}</p>
        {questionCount !== undefined && questionCount > 0 ? (
          <p className="text-ink-subtle text-caption mt-1">
            {questionCount === 1
              ? '1 question drafted so far.'
              : `${questionCount} questions drafted so far.`}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5" aria-hidden>
        <span
          className="bg-blurple/40 size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="bg-blurple/70 size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="bg-blurple size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}
