import { motion } from 'framer-motion';

/**
 * Animated wrapper for the body's branch swap (error / clearing /
 * empty / messages). Opacity-only fade per the animate-only-
 * `transform`/`opacity`/`filter` rule. Honors `prefers-reduced-
 * motion` by skipping the animation entirely.
 */
export function FadeSwap({
  children,
  reducedMotion,
}: {
  children: React.ReactNode;
  reducedMotion: boolean;
}): React.JSX.Element {
  if (reducedMotion) {
    return <div className="h-full">{children}</div>;
  }
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
