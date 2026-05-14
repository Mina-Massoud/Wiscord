import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { AttemptAnswer, RedactedQuestion } from '@/types/quiz';

import { QuizAnswerTile } from './QuizAnswerTile';

interface QuizPlayerCardProps {
  question: RedactedQuestion;
  questionNumber: number;
  totalQuestions: number;
  /** Existing answer for this question (re-entry / re-edit before submit). */
  existingAnswer: AttemptAnswer | null;
  onCommit: (payload: PlayerAnswerPayload) => Promise<void>;
  onNext: () => void;
  isLast: boolean;
  isSubmitting: boolean;
}

export interface PlayerAnswerPayload {
  selectedOptionIds?: string[];
  selectedBool?: boolean;
  text?: string;
}

/**
 * Single-question card for the async player. Owns the participant's
 * working draft for this question; commits to the server on Next.
 *
 * Async-only behavior in PR1 — live commits per-tap and locks the tile.
 */
export function QuizPlayerCard({
  question,
  questionNumber,
  totalQuestions,
  existingAnswer,
  onCommit,
  onNext,
  isLast,
  isSubmitting,
}: QuizPlayerCardProps): React.JSX.Element {
  const [selectedIds, setSelectedIds] = useState<string[]>(existingAnswer?.selectedOptionIds ?? []);
  const [selectedBool, setSelectedBool] = useState<boolean | null>(
    existingAnswer?.selectedBool ?? null,
  );
  const [text, setText] = useState<string>(existingAnswer?.text ?? '');

  // When the question switches, hydrate from any existing answer for the new id.
  useEffect(() => {
    setSelectedIds(existingAnswer?.selectedOptionIds ?? []);
    setSelectedBool(existingAnswer?.selectedBool ?? null);
    setText(existingAnswer?.text ?? '');
  }, [question.id, existingAnswer]);

  const canAdvance = canSubmit(question, selectedIds, selectedBool, text);

  const handleNext = async (): Promise<void> => {
    if (!canAdvance) return;
    await onCommit(buildPayload(question.type, selectedIds, selectedBool, text));
    onNext();
  };

  const toggleOption = (id: string): void => {
    if (question.type === 'mcq_single') {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="bg-glass-surface-1 border-glass-border flex w-full max-w-2xl flex-col gap-6 rounded-lg border p-6">
      <div className="flex items-center justify-between">
        <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
          Question {questionNumber} of {totalQuestions}
        </span>
      </div>

      <h2 className="text-ink text-subhead leading-snug font-semibold">{question.prompt}</h2>

      {(question.type === 'mcq_single' || question.type === 'mcq_multi') && (
        <ul role="list" className="flex flex-col gap-2.5">
          {question.options.map((opt, i) => (
            <li key={opt.id}>
              <QuizAnswerTile
                letter={String.fromCharCode(65 + i)}
                text={opt.text}
                selected={selectedIds.includes(opt.id)}
                onSelect={() => toggleOption(opt.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {question.type === 'true_false' && (
        <div className="grid grid-cols-2 gap-3">
          {([true, false] as const).map((value) => (
            <QuizAnswerTile
              key={String(value)}
              letter={value ? 'T' : 'F'}
              text={value ? 'True' : 'False'}
              selected={selectedBool === value}
              onSelect={() => setSelectedBool(value)}
            />
          ))}
        </div>
      )}

      {question.type === 'short' && (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your answer."
          maxLength={2000}
          rows={5}
        />
      )}

      <div className="flex items-center justify-end pt-2">
        <Button onClick={handleNext} disabled={!canAdvance || isSubmitting}>
          {isLast ? 'Review & submit' : 'Next'}
          <ChevronRight className="ml-2 size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function canSubmit(
  question: RedactedQuestion,
  selectedIds: string[],
  selectedBool: boolean | null,
  text: string,
): boolean {
  if (question.type === 'mcq_single') return selectedIds.length === 1;
  if (question.type === 'mcq_multi') return selectedIds.length >= 1;
  if (question.type === 'true_false') return selectedBool !== null;
  return text.trim().length > 0;
}

function buildPayload(
  type: RedactedQuestion['type'],
  selectedIds: string[],
  selectedBool: boolean | null,
  text: string,
): PlayerAnswerPayload {
  if (type === 'mcq_single' || type === 'mcq_multi') return { selectedOptionIds: selectedIds };
  if (type === 'true_false') return { selectedBool: selectedBool ?? undefined };
  return { text };
}
