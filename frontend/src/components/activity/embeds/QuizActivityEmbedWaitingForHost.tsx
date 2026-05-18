import { ListChecks, Pencil } from 'lucide-react';

interface WaitingForHostProps {
  hostDisplayName: string;
  /** Optional — when we know the draft's question count, show progress copy. */
  questionCount?: number;
}

/**
 * Participant-facing waiting state while the host is still drafting the
 * quiz. Voice-channel Gen Z energy: a personal "X is cooking" line, a
 * pulsing icon stack (ListChecks card + Pencil overlay reads as
 * "list-is-being-authored"), and a three-dot bouncing progress beat.
 *
 * The icon stays literal per the CLAUDE.md rule — no sparkles or magic
 * glyphs even though the surface feels "AI-shaped" with the animation;
 * the activity is purely a quiz, not an AI surface.
 */
export function WaitingForHost({
  hostDisplayName,
  questionCount,
}: WaitingForHostProps): React.JSX.Element {
  const phrases = [
    'No peeking until the quiz drops.',
    'Stretch — questions are loading.',
    'It’s gonna hit different.',
  ];
  // Rotate the phrase based on the question count when available so the
  // copy feels alive as the host works; otherwise stay on the first line.
  const phraseIndex =
    typeof questionCount === 'number' ? Math.min(questionCount, phrases.length - 1) : 0;
  const phrase = phrases[phraseIndex] ?? phrases[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative">
        <span className="bg-glass-surface-1 border-glass-border ease-wiscord duration-base flex size-24 items-center justify-center rounded-2xl border">
          <ListChecks className="text-ink-muted size-10" strokeWidth={1.5} aria-hidden />
        </span>
        <span
          className="bg-blurple ring-glass-surface-2 absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full ring-2"
          aria-hidden
        >
          <Pencil className="size-3.5 animate-pulse text-white" strokeWidth={2.5} />
        </span>
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-ink text-subhead font-semibold">
          {hostDisplayName} is cooking up a quiz.
        </h2>
        <p className="text-ink-muted text-control">{phrase}</p>
        {questionCount !== undefined && questionCount > 0 ? (
          <p className="text-ink-subtle text-caption mt-1">
            {questionCount === 1
              ? '1 question drafted so far.'
              : `${questionCount} questions drafted so far.`}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5" aria-hidden>
        <span
          className="bg-blurple/40 size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="bg-blurple/70 size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="bg-blurple size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}
