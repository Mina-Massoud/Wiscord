import { quizGenZ } from '@/lib/copy/quiz-genz';
import type { QuizQuestionBreakdown as QuestionRow } from '@/types/quiz';
import { QuestionCard } from './QuizQuestionBreakdownQuestionCard';

interface QuizQuestionBreakdownProps {
  rows: QuestionRow[];
}

/**
 * Per-question accuracy + distribution. For MCQ and true/false we know the
 * full option set up-front and label each bar; for short-answer we show
 * top-frequency text buckets, otherwise an empty-state line.
 */
export function QuizQuestionBreakdown({ rows }: QuizQuestionBreakdownProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
        {quizGenZ.perQuestion.sectionTitle}
      </h2>
      <ul role="list" className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <QuestionCard key={row.questionId} row={row} index={index} />
        ))}
      </ul>
    </section>
  );
}
