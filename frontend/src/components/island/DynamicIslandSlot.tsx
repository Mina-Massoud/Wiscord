import { motion } from 'framer-motion';
import { ISLAND_CONTENT_VARIANTS } from './animations';
import type { IslandShape } from './islandShapes';

/**
 * Fixed-dimension content slot. Each option is mounted inside its own
 * Slot, which pins its size to `ISLAND_SHAPES[mode]` regardless of
 * what the parent shell is currently morphing through. Anchored
 * top-right so the content sits exactly where the *target* pill will
 * end up — combined with `overflow: hidden` on the shell, this kills
 * the "small-pill content rendered at expanded-card dimensions" bug
 * you'd otherwise see during the morph.
 *
 * Owns the content fade variants so the views themselves stay plain
 * markup. Padding lives here too (per-shape).
 */
interface SlotProps {
  shape: IslandShape;
  children: React.ReactNode;
}

export function Slot({ shape, children }: SlotProps): React.JSX.Element {
  // Slot fills the shell (h-full w-full) instead of pinning to a fixed
  // target size. With `mode="wait"` only ONE Slot renders at a time,
  // so it can safely stretch to the current shell dimensions. The
  // shell itself animates width/height via `animate` (NOT `layout`),
  // so children get their natural sizing — no transform-scale, no
  // squish frame, no void corner during a big-to-small morph.
  //
  // Padding lives here per-shape so the content insets shrink with
  // the shell during a collapse instead of jumping at exit-complete.
  return (
    <motion.div
      variants={ISLAND_CONTENT_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="h-full w-full"
      style={{
        paddingInline: shape.paddingX,
        paddingBlock: shape.paddingY,
      }}
    >
      {children}
    </motion.div>
  );
}
