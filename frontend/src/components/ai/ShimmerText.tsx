import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/cn';

interface ShimmerTextProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Apple-Intelligence-style shimmer applied to text. A linear
 * gradient sweeps left-to-right across the glyphs by combining
 * `background-clip: text` with `-webkit-text-fill-color: transparent`
 * and an animated `background-position`.
 *
 * Respects `prefers-reduced-motion` — when reduced motion is on,
 * the gradient stays static (still readable, just no sweep).
 *
 * Used by the AI capsule's "cooking…" beat so the model's
 * thinking-time visualisation matches the same brand vocabulary
 * Apple's own Intelligence UI made canonical.
 */
export function ShimmerText({ children, className }: ShimmerTextProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  return (
    <span
      className={cn('text-ai-shimmer', reducedMotion && 'text-ai-shimmer-static', className)}
      aria-live="off"
    >
      {children}
    </span>
  );
}
