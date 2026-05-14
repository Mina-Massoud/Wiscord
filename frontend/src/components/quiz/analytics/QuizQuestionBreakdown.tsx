import { Check } from 'lucide-react';

import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { quizGenZ } from '@/lib/copy/quiz-genz';
import { cn } from '@/lib/cn';
import type { QuizQuestionBreakdown as QuestionRow } from '@/types/quiz';

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

interface QuestionCardProps {
  row: QuestionRow;
  index: number;
}

function QuestionCard({ row, index }: QuestionCardProps): React.JSX.Element {
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

interface AccuracyChipProps {
  tone: 'success' | 'warning' | 'destructive';
  label: string;
}

function AccuracyChip({ tone, label }: AccuracyChipProps): React.JSX.Element {
  const toneClass =
    tone === 'success'
      ? 'bg-success/15 text-success'
      : tone === 'warning'
        ? 'bg-warning/15 text-warning'
        : 'bg-destructive/15 text-destructive';
  return (
    <span className={cn('text-badge rounded-pill shrink-0 px-2 py-0.5 font-semibold', toneClass)}>
      {label}
    </span>
  );
}

interface DistributionListProps {
  row: QuestionRow;
  max: number;
}

function DistributionList({ row, max }: DistributionListProps): React.JSX.Element {
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

function AnimatedCount({ value }: { value: number }): React.JSX.Element {
  const animated = useAnimatedNumber(value);
  return <>{Math.round(animated)}</>;
}

function AnimatedPicked({ count }: { count: number }): React.JSX.Element {
  const animated = useAnimatedNumber(count);
  return <>{quizGenZ.perQuestion.pickedThis(Math.round(animated))}</>;
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
