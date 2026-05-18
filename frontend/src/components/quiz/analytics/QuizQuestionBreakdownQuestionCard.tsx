import { quizGenZ } from '@/lib/copy/quiz-genz';
import type { QuizQuestionBreakdown as QuestionRow } from '@/types/quiz';
import { AccuracyChip } from './QuizQuestionBreakdownAccuracyChip';
import { DistributionList } from './QuizQuestionBreakdownDistributionList';

interface QuestionCardProps {
  row: QuestionRow;
  index: number;
}

export function QuestionCard({ row, index }: QuestionCardProps): React.JSX.Element {
  const max = row.distribution.reduce((acc, b) => Math.max(acc, b.count), 1);
  const accuracyTone =
    row.accuracy >= 0.8 ? 'success' : row.accuracy >= 0.5 ? 'warning' : 'destructive';

  return (
    <li className="bg-glass-surface-1 border-glass-border flex flex-col gap-3 rounded-lg border p-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <span className="bg-blurple/10 text-blurple text-badge mt-0.5 flex size-6 shrink-0 items-center justify-center rounded font-semibold">
            {index + 1}
          </span>
          <h3 className="text-ink text-subhead min-w-0 flex-1 font-semibold break-words">
            {row.prompt || 'Untitled question'}
          </h3>
          <AccuracyChip
            tone={accuracyTone}
            label={quizGenZ.perQuestion.accuracyTag(row.accuracy)}
          />
        </div>
        <p className="text-ink-muted text-caption">
          {quizGenZ.perQuestion.answered(row.answeredCount)}
        </p>
      </header>

      <DistributionList row={row} max={max} />
    </li>
  );
}
