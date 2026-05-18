import type { IslandMode } from './DynamicIsland';

/**
 * Shape spec per island mode. Single source of truth for width, height,
 * radius, and padding. Each value is applied inline via `style` so
 * framer-motion's `animate` prop interpolates them with the shell
 * spring (CSS `min-width` doesn't interpolate the same way `width`
 * does — the previous `min-w-[*]` classes produced a snappier-than-
 * springy change of size).
 *
 * Three tiers live in the current routing:
 *
 *   tier 1 — minimal pill   (date)
 *   tier 2 — wide pill      (next-event idle widget)
 *   tier 3 — compact card   (event-soon)
 *   tier 4 — expanded sheet (the full embedded calendar)
 *
 * Heights are deliberately quantised — three discrete values (26 / 72
 * / 560) — so the layout morph passes through tier-aligned proportions
 * instead of interpolating arbitrary in-between sizes.
 *
 * Pomodoro / voice shape specs were removed when those modes were
 * deferred to v2; add them back here when the routing wires up.
 */
export interface IslandShape {
  width: number;
  height: number;
  /** Tailwind radius class, picked per shape so the morph passes
   *  through three discrete curvatures instead of interpolating one. */
  radiusClass: string;
  /** Inline padding shorthand applied via style; framer needs raw
   *  values to interpolate padding smoothly. */
  paddingX: number;
  paddingY: number;
}

export const ISLAND_SHAPES: Record<IslandMode, IslandShape> = {
  date: {
    width: 140,
    height: 26,
    radiusClass: 'rounded-island-pill',
    paddingX: 12,
    paddingY: 0,
  },
  'next-event': {
    width: 240,
    height: 26,
    radiusClass: 'rounded-island-pill',
    paddingX: 12,
    paddingY: 0,
  },
  'pomodoro-tick': {
    width: 132,
    height: 26,
    radiusClass: 'rounded-island-pill',
    paddingX: 12,
    paddingY: 0,
  },
  'event-soon': {
    width: 340,
    height: 72,
    radiusClass: 'rounded-island-card',
    paddingX: 14,
    paddingY: 10,
  },
  'pomodoro-card': {
    // Apple-DI horizontal grammar: circular emblem hard-left, time
    // + meta stacked middle, close hard-right. Sized like Forest /
    // Opal / Duolingo's expanded live-activity cards — wide and
    // short, not a square hero. ~480×170 fits the row without
    // dwarfing the rest of the chrome.
    width: 480,
    height: 300,
    radiusClass: 'rounded-island-card',
    paddingX: 18,
    paddingY: 16,
  },
  expanded: {
    width: 960,
    height: 760,
    radiusClass: 'rounded-island-sheet',
    paddingX: 12,
    paddingY: 12,
  },
};
