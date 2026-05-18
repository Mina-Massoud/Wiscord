import type { Transition, Variants, MotionStyle } from 'framer-motion';

/**
 * Animation system for the Dynamic Island.
 *
 * The single biggest fidelity cue is **timing separation**: when the
 * mode changes, the old content fades *all the way out* before the
 * shape morph is visible, then the shape morphs while empty, then the
 * new content fades in over the morph. Without this separation you
 * get the "squish and zoom" frame where the old card's contents
 * visibly compress as the shell shrinks beneath them.
 *
 * Three coordinated phases:
 *
 *   t=0          mode changes, exit fires on outgoing content
 *   t=0..60ms    exit fade — pure opacity, no y/scale/blur (those
 *                add the "zooming away" artifact that reads as cheap)
 *   t=60ms       AnimatePresence mode="wait" unblocks, new child mounts
 *   t=60ms       shell shape morph starts (delay matches exit duration)
 *   t=140ms      new content begins fading in (overlaps the morph)
 *   t=~360ms     shape settled, new content fully visible
 *
 * The shell spring is calibrated to Mobbin samples (Forest, Opal,
 * Apple Fitness): ~1 frame of overshoot, hard settle. Looser springs
 * (the previous 110/12) read as "popover-y", not "Apple-grade".
 */

const SHELL_DELAY = 0.06;
const EXIT_DURATION = 0.06;

export const ISLAND_SHELL_SPRING: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 30,
  mass: 0.9,
  delay: SHELL_DELAY,
};

export const ISLAND_SHAPE_STYLE: MotionStyle = {
  transformOrigin: 'top right',
  originX: 1,
  originY: 0,
};

export const ISLAND_CONTENT_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.18, delay: 0.08, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: EXIT_DURATION, ease: [0.4, 0, 1, 1] },
  },
};

export const ISLAND_BACKDROP_FADE: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } },
};
