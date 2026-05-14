import { Loader2, ListChecks, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/ui/sidebar-shell';
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
 * quizzes and lets the host create a fresh draft. Shell, header, and
 * async chrome come from `Sidebar.*` — only the row rendering is
 * specific to quizzes.
 */
export function QuizSidebar({
  channelId,
  channelSlug,
  selectedQuizId,
  onSelect,
}: QuizSidebarProps) {
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
    <Sidebar.Root>
      <Sidebar.Header
        icon={<ListChecks className="text-ink-muted size-4 shrink-0" aria-hidden />}
        title={`Labs · Quiz · ${channelSlug}`}
      />

      <Sidebar.Body>
        <Sidebar.Section title="Quizzes">
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

          {list.isLoading && <Sidebar.ListSkeleton rows={3} dotClassName="size-2" />}

          {list.isError && (
            <Sidebar.Error>
              Couldn&apos;t load quizzes.{' '}
              <button
                type="button"
                onClick={() => list.refetch()}
                className="text-blurple underline-offset-2 hover:underline"
              >
                Retry
              </button>
            </Sidebar.Error>
          )}

          {list.data && list.data.length === 0 && !list.isLoading && (
            <Sidebar.Empty>No quizzes yet. Build the first one above.</Sidebar.Empty>
          )}

          {list.data?.map((quiz) => (
            <QuizRow
              key={quiz.id}
              quiz={quiz}
              selected={quiz.id === selectedQuizId}
              onSelect={() => onSelect(quiz.id)}
            />
          ))}
        </Sidebar.Section>
      </Sidebar.Body>
    </Sidebar.Root>
  );
}

interface QuizRowProps {
  quiz: Quiz;
  selected: boolean;
  onSelect: () => void;
}

function QuizRow({ quiz, selected, onSelect }: QuizRowProps) {
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
