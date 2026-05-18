import { Plus } from 'lucide-react';
import { Reorder } from 'framer-motion';

import { Button } from '@/components/ui/button';
import type { QuizQuestion } from '@/types/quiz';
import { SortableQuestionRow } from './QuizQuestionListSortableQuestionRow';

interface QuizQuestionListProps {
  questions: QuizQuestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReorder: (next: QuizQuestion[]) => void;
}

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
