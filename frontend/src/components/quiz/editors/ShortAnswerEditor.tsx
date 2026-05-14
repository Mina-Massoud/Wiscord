import { Textarea } from '@/components/ui/textarea';
import type { ShortAnswerQuestion } from '@/types/quiz';

interface ShortAnswerEditorProps {
  question: ShortAnswerQuestion;
  onChange: (next: ShortAnswerQuestion) => void;
}

/**
 * Short-answer editor — a free-text reference answer (host-only) plus a
 * helper line setting expectations: participants type a free response, host
 * grades after the quiz closes. No auto-grading in v1.
 */
export function ShortAnswerEditor({
  question,
  onChange,
}: ShortAnswerEditorProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-muted text-caption">
        Participants type a free response. You&apos;ll grade attempts after the quiz closes.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`ref-${question.id}`} className="text-ink-muted text-caption">
          Reference answer (only visible to you)
        </label>
        <Textarea
          id={`ref-${question.id}`}
          value={question.referenceAnswer ?? ''}
          onChange={(e) => onChange({ ...question, referenceAnswer: e.target.value })}
          placeholder="Write the answer you'll be checking participants against."
          maxLength={500}
          rows={3}
        />
      </div>
    </div>
  );
}
