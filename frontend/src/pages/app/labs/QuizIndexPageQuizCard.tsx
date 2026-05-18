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

interface QuizCardProps {
  quiz: Quiz;
  onSelect: () => void;
}

export function QuizCard({ quiz, onSelect }: QuizCardProps): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="bg-glass-surface-1 border-glass-border hover:border-glass-border-strong flex h-full w-full flex-col gap-2 rounded-lg border p-4 text-left transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-ink text-control min-w-0 flex-1 font-semibold break-words">
            {quiz.title || 'Untitled quiz'}
          </h3>
          <span className="flex shrink-0 items-center gap-1.5">
            <span aria-hidden className={cn('size-2 rounded-full', STATUS_DOT[quiz.status])} />
            <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
              {STATUS_LABEL[quiz.status]}
            </span>
          </span>
        </div>
        <p className="text-ink-muted text-caption">
          {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'}
          {quiz.mode ? ` · ${quiz.mode}` : ''}
        </p>
      </button>
    </li>
  );
}
