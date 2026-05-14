import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';

interface QuizAnswerTileProps {
  letter: string;
  text: string;
  selected: boolean;
  onSelect: () => void;
  /** Locked tiles can't be re-selected (live mode after answer commit). */
  locked?: boolean;
  /** Right answer marker — shown only after the participant submits. */
  revealCorrect?: boolean;
  /** Wrong-but-picked marker — shown only after submit. */
  revealWrong?: boolean;
}

/**
 * One answer tile for the participant player. Click target is the whole
 * tile — per the UI rules, custom is OK for "feature-specific surfaces"
 * (the tile is the surface, not a button-styled rectangle).
 */
export function QuizAnswerTile({
  letter,
  text,
  selected,
  onSelect,
  locked,
  revealCorrect,
  revealWrong,
}: QuizAnswerTileProps): React.JSX.Element {
  const showReveal = revealCorrect || revealWrong;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={locked}
      aria-pressed={selected}
      className={cn(
        'group bg-glass-surface-1 border-glass-border text-ink relative flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors',
        'focus-visible:ring-blurple focus-visible:ring-offset-canvas focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'hover:border-glass-border-strong',
        selected && !showReveal && 'border-blurple bg-blurple/10 ring-blurple ring-1',
        revealCorrect && 'border-success bg-success/10 ring-success ring-1',
        revealWrong && 'border-destructive bg-destructive/10 ring-destructive ring-1',
        locked && !selected && 'opacity-60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'text-control flex size-9 shrink-0 items-center justify-center rounded-md font-semibold',
          'bg-blurple/10 text-blurple',
          revealCorrect && 'bg-success/20 text-success',
          revealWrong && 'bg-destructive/20 text-destructive',
        )}
      >
        {letter}
      </span>
      <span className="text-control min-w-0 flex-1">{text}</span>
      {revealCorrect && <Check className="text-success size-5 shrink-0" aria-hidden />}
    </button>
  );
}
