import { Check, Pencil } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { changeQuestionType, validateQuestion } from './lib/draft-quiz';
import { McqMultiEditor } from './editors/McqMultiEditor';
import { McqSingleEditor } from './editors/McqSingleEditor';
import { ShortAnswerEditor } from './editors/ShortAnswerEditor';
import { TrueFalseEditor } from './editors/TrueFalseEditor';
import type { QuizQuestion, QuizQuestionType } from '@/types/quiz';

interface QuizQuestionEditorProps {
  question: QuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  onChange: (next: QuizQuestion) => void;
}

const TYPE_LABELS: Record<QuizQuestionType, string> = {
  mcq_single: 'Multiple choice — single',
  mcq_multi: 'Multiple choice — multi',
  true_false: 'True / False',
  short: 'Short answer',
};

const TYPE_OPTIONS: QuizQuestionType[] = ['mcq_single', 'mcq_multi', 'true_false', 'short'];

/**
 * Routes to the right variant editor based on the question type. Owns the
 * shared frame: type picker, prompt, validation summary, then the answer
 * surface. Per the design rule, no nested borders — this card sits on
 * `surface-1` over the canvas, divided by spacing not lines.
 */
export function QuizQuestionEditor({
  question,
  questionNumber,
  totalQuestions,
  onChange,
}: QuizQuestionEditorProps): React.JSX.Element {
  const issues = validateQuestion(question);

  return (
    <div className="bg-glass-surface-1 border-glass-border flex flex-col gap-5 rounded-lg border p-5">
      <header className="flex items-center justify-between gap-3">
        <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
          Question {questionNumber} of {totalQuestions}
        </span>
        <Select
          value={question.type}
          onValueChange={(next) => onChange(changeQuestionType(question, next as QuizQuestionType))}
        >
          <SelectTrigger className="bg-surface-composer h-9 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`prompt-${question.id}`} className="text-ink-muted text-caption">
          <Pencil className="mr-1 inline size-3" aria-hidden />
          Prompt
        </label>
        <Textarea
          id={`prompt-${question.id}`}
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          placeholder="What do you want to ask?"
          maxLength={500}
          rows={2}
          className="text-subhead"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-ink-muted text-caption">
          <Check className="mr-1 inline size-3" aria-hidden />
          Answer
        </span>
        {question.type === 'mcq_single' && (
          <McqSingleEditor question={question} onChange={onChange} />
        )}
        {question.type === 'mcq_multi' && (
          <McqMultiEditor question={question} onChange={onChange} />
        )}
        {question.type === 'true_false' && (
          <TrueFalseEditor question={question} onChange={onChange} />
        )}
        {question.type === 'short' && <ShortAnswerEditor question={question} onChange={onChange} />}
      </div>

      {issues.length > 0 && (
        <ul
          role="list"
          className="bg-warning/5 border-warning/30 text-warning text-caption flex flex-col gap-1 rounded-md border px-3 py-2"
        >
          {issues.map((i, idx) => (
            <li key={`${i.field}-${idx}`}>· {i.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
