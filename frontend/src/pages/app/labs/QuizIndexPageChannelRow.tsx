import { Hash } from 'lucide-react';
import type { ChannelGroup } from './QuizIndexPage';

interface ChannelRowProps {
  group: ChannelGroup;
  onSelect: () => void;
}

export function ChannelRow({ group, onSelect }: ChannelRowProps): React.JSX.Element {
  const count = group.quizzes.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group hover:bg-surface-hover flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors"
    >
      <Hash className="text-ink-muted mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink text-tab truncate font-mono">{group.slug}</span>
        <span className="text-ink-subtle text-badge">
          {count} {count === 1 ? 'quiz' : 'quizzes'}
        </span>
      </span>
    </button>
  );
}
