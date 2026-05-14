import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { validateQuestion } from './lib/draft-quiz';
import type { QuizQuestion } from '@/types/quiz';

interface QuizQuestionListProps {
  questions: QuizQuestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReorder: (next: QuizQuestion[]) => void;
}

const TYPE_BADGE: Record<QuizQuestion['type'], string> = {
  mcq_single: 'MCQ · single',
  mcq_multi: 'MCQ · multi',
  true_false: 'T / F',
  short: 'Short',
};

/**
 * Left-rail question list inside the builder. Click a row to select; click
 * the trash icon to remove; grab the grip on the left to reorder. Reorder
 * is wired via framer-motion `Reorder` so the layout shift animates and
 * the dragged row floats over its siblings.
 *
 * Drag is gated to the grip handle (not the whole row) via
 * `dragListener={false}` + a per-row `useDragControls()` so clicking
 * elsewhere on the row still selects.
 */
export function QuizQuestionList({
  questions,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
}: QuizQuestionListProps): React.JSX.Element {
  return (
    <div className="bg-glass-chrome border-glass-border flex h-full flex-col border-r">
      <div className="border-glass-border flex items-center justify-between border-b px-3 py-2">
        <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
          Questions · {questions.length}
        </span>
      </div>

      <Reorder.Group
        axis="y"
        values={questions}
        onReorder={onReorder}
        as="ul"
        className="flex flex-1 flex-col gap-1 overflow-y-auto p-2"
      >
        {questions.map((q, i) => (
          <SortableQuestionRow
            key={q.id}
            question={q}
            index={i}
            selected={q.id === selectedId}
            onSelect={() => onSelect(q.id)}
            onRemove={() => onRemove(q.id)}
          />
        ))}
      </Reorder.Group>

      <div className="border-glass-border border-t p-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onAdd}
          className="text-ink-muted hover:text-ink w-full justify-start"
        >
          <Plus className="mr-2 size-4" aria-hidden />
          Add question
        </Button>
      </div>
    </div>
  );
}

interface SortableQuestionRowProps {
  question: QuizQuestion;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SortableQuestionRow({
  question,
  index,
  selected,
  onSelect,
  onRemove,
}: SortableQuestionRowProps): React.JSX.Element {
  const controls = useDragControls();
  const issues = validateQuestion(question);

  return (
    <Reorder.Item
      value={question}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, zIndex: 1 }}
      transition={{ type: 'spring', stiffness: 600, damping: 40 }}
      className="list-none"
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'group hover:bg-surface-hover flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
          selected && 'bg-surface-active hover:bg-surface-active',
        )}
      >
        <span
          role="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            controls.start(e);
          }}
          className="text-ink-subtle hover:text-ink mt-0.5 flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </span>
        <span className="bg-surface-composer text-ink-muted text-badge mt-0.5 flex size-5 shrink-0 items-center justify-center rounded font-semibold">
          {index + 1}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-ink text-control truncate">
            {question.prompt.trim() || 'Untitled question'}
          </span>
          <span className="text-ink-subtle text-badge">
            {TYPE_BADGE[question.type]}
            {issues.length > 0 && <span className="text-warning"> · needs fixing</span>}
          </span>
        </span>
        <Trash2
          role="button"
          aria-label="Remove question"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-ink-subtle hover:text-destructive size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    </Reorder.Item>
  );
}
