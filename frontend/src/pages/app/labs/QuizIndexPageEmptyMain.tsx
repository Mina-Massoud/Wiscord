import { ListChecks } from 'lucide-react';

export function EmptyMain(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <span
        aria-hidden
        className="bg-glass-surface-1 border-glass-border flex size-16 items-center justify-center rounded-full border"
      >
        <ListChecks className="text-ink-muted size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-ink text-subhead font-semibold">No quizzes yet</h2>
        <p className="text-ink-muted text-caption max-w-sm">
          Open a channel workshop at{' '}
          <code className="text-ink-subtle">/app/labs/quiz/&lt;channelId&gt;</code> to author your
          first quiz.
        </p>
      </div>
    </div>
  );
}
