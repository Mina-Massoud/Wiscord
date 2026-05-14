import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface UseAnimatedNumberOptions {
  duration?: number;
}

/**
 * Tween a number toward `value` using framer-motion's `animate` driver each
 * time the prop changes. Each frame pushes through React state so the
 * rendered text actually re-paints. Honors `prefers-reduced-motion`.
 *
 * https://motion.dev/docs/react-animate-number
 */
export function useAnimatedNumber(
  value: number,
  { duration = 0.8 }: UseAnimatedNumberOptions = {},
): number {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  displayRef.current = display;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
    if (reducedMotion) {
      setDisplay(to);
      return;
    }
    const controls = animate(from, to, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
      onComplete: () => setDisplay(to),
    });
    return () => controls.stop();
  }, [value, duration, reducedMotion]);

  return display;
}
