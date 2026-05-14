import { GripVertical, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroupItem } from '@/components/ui/radio-group';
import type { QuizOption } from '@/types/quiz';

interface QuizOptionRowProps {
  option: QuizOption;
  /** 'single' renders a radio (RadioGroupItem); 'multi' renders a checkbox. */
  selectMode: 'single' | 'multi';
  onChangeText: (text: string) => void;
  onToggleCorrect: () => void;
  onRemove: () => void;
  /** Whether the row's remove control is disabled (e.g. minimum option count). */
  removeDisabled?: boolean;
  /**
   * Wired by the parent's `Reorder.Item` to start a drag from the grip icon
   * (rather than the whole row) so the input remains clickable. When omitted,
   * the grip is decorative.
   */
  onDragHandlePointerDown?: (event: React.PointerEvent) => void;
}

/**
 * One option row inside an MCQ editor. The grip on the left is the drag
 * handle — wired by the parent via `onDragHandlePointerDown` to a
 * framer-motion `useDragControls()` instance so dragging only starts from
 * the icon (not anywhere on the row, which would steal focus from the
 * text input).
 *
 * The "correct" toggle is rendered as either a Radio (single-select) or a
 * Checkbox (multi-select). Both are shadcn primitives; we never re-implement
 * them as custom divs.
 */
export function QuizOptionRow({
  option,
  selectMode,
  onChangeText,
  onToggleCorrect,
  onRemove,
  removeDisabled,
  onDragHandlePointerDown,
}: QuizOptionRowProps): React.JSX.Element {
  return (
    <div className="bg-glass-surface-1 border-glass-border hover:border-glass-border-strong group flex items-center gap-3 rounded-md border px-3 py-2 transition-colors">
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(e) => {
          e.preventDefault();
          onDragHandlePointerDown?.(e);
        }}
        className="text-ink-subtle hover:text-ink flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <label className="flex shrink-0 cursor-pointer items-center" aria-label="Mark as correct">
        {selectMode === 'single' ? (
          <RadioGroupItem
            value={option.id}
            aria-label={`Mark "${option.text || 'option'}" correct`}
          />
        ) : (
          <Checkbox
            checked={option.isCorrect}
            onCheckedChange={onToggleCorrect}
            aria-label={`Mark "${option.text || 'option'}" correct`}
          />
        )}
      </label>

      <Input
        value={option.text}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder="Option text"
        className="bg-surface-composer text-control h-8 min-w-0 flex-1 border-transparent"
        maxLength={280}
      />

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onRemove}
        disabled={removeDisabled}
        aria-label="Remove option"
        className="text-ink-subtle hover:text-destructive size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
