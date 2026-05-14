import { Loader2, ListChecks, Plus } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import { useChannelQuizzes, useCreateQuiz } from '@/queries/quiz';
import type { Quiz, QuizStatus } from '@/types/quiz';

interface QuizSidebarProps {
  channelId: string;
  channelSlug: string;
  selectedQuizId: string | null;
  onSelect: (quizId: string) => void;
}

const STATUS_LABEL: Record<QuizStatus, string> = {
  draft: 'Draft',
  live: 'Live',
  open: 'Open',
  closed: 'Closed',
};

const STATUS_DOT: Record<QuizStatus, string> = {
  draft: 'bg-ink-subtle',
  live: 'bg-presence-online',
  open: 'bg-blurple',
  closed: 'bg-ink-subtle',
};

/**
 * Sidebar in the `sidebar` slot of the labs shell. Lists the channel's
 * quizzes, lets the host create a fresh draft. Mirrors the shape of the
 * voice channel sidebar so the labs shell feels consistent.
 */
export function QuizSidebar({
  channelId,
  channelSlug,
  selectedQuizId,
  onSelect,
}: QuizSidebarProps): React.JSX.Element {
  const list = useChannelQuizzes(channelId);
  const create = useCreateQuiz();

  const handleCreate = (): void => {
    create.mutate(
      { channelId, title: 'Untitled quiz' },
      {
        onSuccess: (quiz) => {
          toast.success('Draft created');
          onSelect(quiz.id);
        },
        onError: (err) => {
          toast.error(err.message || "Couldn't create draft");
        },
      },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-glass-border h-app-titlebar flex shrink-0 items-center border-b px-4">
        <ListChecks className="text-ink-muted mr-2 size-4 shrink-0" aria-hidden />
        <span className="text-ink text-control truncate font-semibold">
          Labs · Quiz · {channelSlug}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-1 overflow-auto px-2 py-3">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
            Quizzes
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={handleCreate}
          disabled={create.isPending}
          className="text-ink-muted hover:text-ink justify-start"
        >
          {create.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="mr-2 size-4" aria-hidden />
          )}
          New quiz
        </Button>

        {list.isLoading && <SidebarSkeleton />}
        {list.isError && (
          <p className="text-ink-muted text-caption px-2 py-1">
            Couldn&apos;t load quizzes.{' '}
            <button
              type="button"
              onClick={() => list.refetch()}
              className="text-blurple underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </p>
        )}
        {list.data && list.data.length === 0 && !list.isLoading && (
          <p className="text-ink-muted text-caption px-2 py-2">
            No quizzes yet. Build the first one above.
          </p>
        )}
        {list.data?.map((quiz) => (
          <QuizRow
            key={quiz.id}
            quiz={quiz}
            selected={quiz.id === selectedQuizId}
            onSelect={() => onSelect(quiz.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface QuizRowProps {
  quiz: Quiz;
  selected: boolean;
  onSelect: () => void;
}

function QuizRow({ quiz, selected, onSelect }: QuizRowProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group hover:bg-surface-hover flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
        selected && 'bg-surface-active hover:bg-surface-active',
      )}
    >
      <span
        aria-hidden
        className={cn('mt-1.5 size-2 shrink-0 rounded-full', STATUS_DOT[quiz.status])}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink text-tab truncate">{quiz.title || 'Untitled'}</span>
        <span className="text-ink-subtle text-badge">
          {STATUS_LABEL[quiz.status]}
          {' · '}
          {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'}
        </span>
      </span>
    </button>
  );
}

function SidebarSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 px-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-2 px-1.5 py-2">
          <Skeleton className="mt-1.5 size-2 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
