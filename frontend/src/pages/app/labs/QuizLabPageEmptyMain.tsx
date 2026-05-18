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
        <h2 className="text-ink text-subhead font-semibold">Build the channel&apos;s first quiz</h2>
        <p className="text-ink-muted text-caption">
          Pick or create one in the sidebar to get started.
        </p>
      </div>
    </div>
  );
}
