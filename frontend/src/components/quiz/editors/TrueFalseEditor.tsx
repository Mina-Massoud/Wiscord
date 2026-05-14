import { cn } from '@/lib/cn';
import type { TrueFalseQuestion } from '@/types/quiz';

interface TrueFalseEditorProps {
  question: TrueFalseQuestion;
  onChange: (next: TrueFalseQuestion) => void;
}

const CHOICES: Array<{ label: string; value: boolean }> = [
  { label: 'True', value: true },
  { label: 'False', value: false },
];

/**
 * The two-tile picker for true/false questions. Click target is the whole
 * tile — per the rules, that's the allowed exception to "always use shadcn
 * Button" because the tile is the surface, not a button-styled rectangle.
 */
export function TrueFalseEditor({ question, onChange }: TrueFalseEditorProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CHOICES.map((choice) => {
        const selected = question.correct === choice.value;
        return (
          <button
            key={String(choice.value)}
            type="button"
            onClick={() => onChange({ ...question, correct: choice.value })}
            aria-pressed={selected}
            className={cn(
              'border-glass-border bg-glass-surface-1 hover:border-glass-border-strong text-ink text-subhead relative flex h-20 items-center justify-center rounded-md border font-semibold transition-colors',
              'focus-visible:ring-blurple focus-visible:ring-offset-canvas focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
              selected && 'border-blurple bg-blurple/10 text-blurple ring-blurple ring-1',
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
