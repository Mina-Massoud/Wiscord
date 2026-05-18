import { cn } from '@/lib/cn';
import type { Quiz, QuizStatus } from '@/types/quiz';

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

interface QuizRowProps {
  quiz: Quiz;
  selected: boolean;
  onSelect: () => void;
}

export function QuizRow({ quiz, selected, onSelect }: QuizRowProps) {
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
