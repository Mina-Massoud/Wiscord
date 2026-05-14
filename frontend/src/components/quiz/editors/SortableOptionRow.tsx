import { Reorder, useDragControls } from 'framer-motion';

import { QuizOptionRow } from '../QuizOptionRow';
import type { QuizOption } from '@/types/quiz';

interface SortableOptionRowProps {
  option: QuizOption;
  selectMode: 'single' | 'multi';
  onChangeText: (text: string) => void;
  onToggleCorrect: () => void;
  onRemove: () => void;
  removeDisabled?: boolean;
}

/**
 * Reorder.Item wrapper that owns its own `useDragControls()` so the drag
 * starts only from the grip handle (not the whole row). Lives in its own
 * file so the hook can be called per-row without violating rules-of-hooks
 * inside a parent loop.
 *
 * `whileDrag` lifts the row slightly via transform — compositor-friendly
 * per the animation rules — and bumps z-index so the dragged row floats
 * over its siblings cleanly.
 */
export function SortableOptionRow({
  option,
  selectMode,
  onChangeText,
  onToggleCorrect,
  onRemove,
  removeDisabled,
}: SortableOptionRowProps): React.JSX.Element {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={option}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, zIndex: 1 }}
      transition={{ type: 'spring', stiffness: 600, damping: 40 }}
      className="list-none"
    >
      <QuizOptionRow
        option={option}
        selectMode={selectMode}
        onChangeText={onChangeText}
        onToggleCorrect={onToggleCorrect}
        onRemove={onRemove}
        removeDisabled={removeDisabled}
        onDragHandlePointerDown={(e) => controls.start(e)}
      />
    </Reorder.Item>
  );
}
