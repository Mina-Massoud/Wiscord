import { Loader2, ListChecks, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/ui/sidebar-shell';
import { toast } from '@/lib/toast';
import { useChannelQuizzes, useCreateQuiz } from '@/queries/quiz';
import { QuizRow } from './QuizSidebarQuizRow';

interface QuizSidebarProps {
  channelId: string;
  channelSlug: string;
  selectedQuizId: string | null;
  onSelect: (quizId: string) => void;
}

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
