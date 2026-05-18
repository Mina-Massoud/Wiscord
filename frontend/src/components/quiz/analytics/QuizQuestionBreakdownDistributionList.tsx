import { quizGenZ } from '@/lib/copy/quiz-genz';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { QuizQuestionBreakdown as QuestionRow } from '@/types/quiz';
import { AnimatedCount } from './QuizQuestionBreakdownAnimatedCount';
import { AnimatedPicked } from './QuizQuestionBreakdownAnimatedPicked';

interface DistributionListProps {
  row: QuestionRow;
  max: number;
}

function correctKeysFromRow(row: QuestionRow): Set<string> {
  // The host-side analytics endpoint sends only counts and labels — not which
  // options are correct. We can't recover that from the snapshot alone, so
  // the host UI marks correctness via a follow-up enrichment when the parent
  // page has the full quiz available. For now, return empty — the analytics
  // dashboard treats correctness as unknown at the breakdown level (the
  // overall accuracy chip already conveys it).
  void row;
  return new Set<string>();
}

export function DistributionList({ row, max }: DistributionListProps): React.JSX.Element {
  if (row.type === 'short') {
    if (row.distribution.length === 0) {
      return (
        <p className="text-ink-subtle text-caption italic">{quizGenZ.perQuestion.emptyShort}</p>
      );
    }
    return (
      <ul className="flex flex-col gap-1.5">
        {row.distribution.slice(0, 5).map((bucket) => (
          <li
            key={bucket.key}
            className="bg-glass-callout border-glass-border flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <span className="text-ink text-control min-w-0 flex-1 truncate">{bucket.label}</span>
            <span className="text-ink-muted text-caption shrink-0 tabular-nums">
              <AnimatedPicked count={bucket.count} />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  // MCQ + true/false: show a labeled bar per option with a correct marker.
  const correctKeys = correctKeysFromRow(row);
  return (
    <ul className="flex flex-col gap-2">
      {row.distribution.map((bucket) => {
        const isCorrect = correctKeys.has(bucket.key);
        const fill = bucket.count === 0 ? 0 : Math.max(4, (bucket.count / max) * 100);
        return (
          <li key={bucket.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink text-control flex min-w-0 flex-1 items-center gap-1.5 truncate">
                {isCorrect && <Check className="text-success size-3.5 shrink-0" aria-hidden />}
                <span className="min-w-0 truncate">{bucket.label}</span>
              </span>
              <span className="text-ink-muted text-caption shrink-0 tabular-nums">
                <AnimatedCount value={bucket.count} />
              </span>
            </div>
            <div className="bg-glass-callout rounded-pill h-2 overflow-hidden" role="presentation">
              <div
                className={cn(
                  'rounded-pill duration-base h-full transition-all',
                  isCorrect ? 'bg-success' : 'bg-blurple/70',
                )}
                style={{ width: `${fill}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
