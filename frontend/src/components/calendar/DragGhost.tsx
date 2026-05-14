import { createPortal } from 'react-dom';

import type { DragGhost as DragGhostState } from './useCalendarDrag';

interface DragGhostProps {
  ghost: DragGhostState | null;
}

/**
 * Tiny floating preview that follows the pointer during a reschedule drag.
 * Rendered into a body-level portal so it escapes any clipping ancestor
 * (scroll containers, overflow:hidden grids).
 */
export function DragGhost({ ghost }: DragGhostProps): React.JSX.Element | null {
  if (!ghost) return null;
  return createPortal(
    <div
      aria-hidden
      className="bg-glass-surface-2 border-glass-border-strong text-control text-ink shadow-elevated pointer-events-none fixed z-50 truncate rounded-md border px-3 py-1.5"
      style={{
        left: ghost.x,
        top: ghost.y,
        transform: 'translate3d(0,0,0)',
      }}
    >
      {ghost.title}
    </div>,
    document.body,
  );
}
