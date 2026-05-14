import { ListChecks } from 'lucide-react';

import type { QuizQuestion } from '@/types/quiz';

interface QuizLivePreviewProps {
  question: QuizQuestion | null;
  questionNumber: number;
  totalQuestions: number;
}

/**
 * Right-rail preview frame. Mirrors what a participant sees for the
 * currently-selected question. Updates on every keystroke — no preview
 * button. Dim/empty when no question exists yet.
 *
 * Renders correctness indicators *not* by tile color (that would leak the
 * answer) but by a subtle dot in the corner that only appears in the
 * post-submit reveal — which we don't render here.
 */
export function QuizLivePreview({
  question,
  questionNumber,
  totalQuestions,
}: QuizLivePreviewProps): React.JSX.Element {
  return (
    <div className="bg-glass-chrome flex h-full flex-col gap-3 p-3">
      <div className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
        Preview
      </div>

      <div className="bg-glass-callout border-glass-border relative flex flex-1 flex-col gap-4 overflow-hidden rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <ListChecks className="text-blurple size-4" aria-hidden />
          <span className="text-ink-muted text-caption">
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>

        {question === null ? (
          <EmptyPreview />
        ) : (
          <>
            <h3 className="text-ink text-subhead leading-snug font-semibold">
              {question.prompt.trim() || 'Your question prompt will appear here.'}
            </h3>

            {(question.type === 'mcq_single' || question.type === 'mcq_multi') && (
              <ul role="list" className="flex flex-col gap-2">
                {question.options.map((opt, i) => (
                  <li
                    key={opt.id}
                    className="bg-glass-surface-1 border-glass-border text-ink text-control flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="bg-blurple/10 text-blurple text-badge flex size-6 shrink-0 items-center justify-center rounded font-semibold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{opt.text || `Option ${i + 1}`}</span>
                  </li>
                ))}
              </ul>
            )}

            {question.type === 'true_false' && (
              <ul role="list" className="grid grid-cols-2 gap-2">
                {(['True', 'False'] as const).map((label) => (
                  <li
                    key={label}
                    className="bg-glass-surface-1 border-glass-border text-ink text-subhead flex h-12 items-center justify-center rounded-md border font-semibold"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            )}

            {question.type === 'short' && (
              <div className="bg-glass-surface-1 border-glass-border text-ink-subtle text-caption rounded-md border px-3 py-2">
                Participants will type a free response here.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyPreview(): React.JSX.Element {
  return (
    <div className="text-ink-muted text-caption flex flex-1 flex-col items-center justify-center text-center">
      Pick a question on the left to preview it.
    </div>
  );
}
