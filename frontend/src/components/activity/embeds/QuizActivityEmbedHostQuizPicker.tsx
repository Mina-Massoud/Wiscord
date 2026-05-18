import { useChannelQuizzes, useCreateQuiz } from '@/queries/quiz';
import { usePinQuiz } from '@/queries/voice-activity';
import { toast } from '@/lib/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ListChecks } from 'lucide-react';
import { cn } from '@/lib/cn';

interface HostQuizPickerProps {
  channelId: string;
}

export function HostQuizPicker({ channelId }: HostQuizPickerProps): React.JSX.Element {
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
