/**
 * Fixed dimensions per music-capsule view — the shell animates between
 * these via `animate={{ width, height }}` (NOT `layout`, which uses
 * transform: scale and would squish the children mid-morph).
 *
 * Padding lives here per-shape so the inner Slot insets shrink with the
 * shell during a collapse instead of snapping at exit-complete.
 */

export interface MusicShape {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  radiusClass: string;
}

/**
 * Two "expanded" views with their own shapes so picking a song morphs
 * the shell — the search-only card is shorter than the now-playing
 * card, and going between them fires the same spring + content fade as
 * any other mode transition (compare the DynamicIsland's `date` →
 * `event-soon` morph).
 */
export type MusicView =
  | 'idle'
  | 'bar'
  | 'expanded-search'
  | 'expanded-now-playing'
  // Listen-together views — sibling to the now-playing shapes but with
  // their own dimensions. The incoming-connected pill is short and wide
  // (think CallKit incoming-call shape), the disconnected card is taller
  // because it carries a connect CTA + brand mark, and the
  // listen-together-now-playing card matches expanded-now-playing's width
  // plus a small partner-strip header.
  | 'invite-incoming-connected'
  | 'invite-incoming-disconnected'
  | 'invite-outgoing-pending'
  | 'listen-together-now-playing';

export const MUSIC_SHAPES: Record<MusicView, MusicShape> = {
  idle: {
    width: 26,
    height: 26,
    paddingX: 0,
    paddingY: 0,
    radiusClass: 'rounded-full',
  },
  bar: {
    width: 240,
    height: 26,
    paddingX: 8,
    paddingY: 0,
    radiusClass: 'rounded-full',
  },
  'expanded-search': {
    // No track yet — header + search input + results. Shorter than the
    // now-playing card so the morph reads as "card grows when a song
    // loads" instead of arriving at full height empty.
    width: 380,
    height: 200,
    paddingX: 16,
    paddingY: 14,
    radiusClass: 'rounded-3xl',
  },
  'expanded-now-playing': {
    // Track is loaded — cover + title row, scrubber, transport, slim
    // search at the bottom. Compact iOS Dynamic Island music-card
    // proportions.
    width: 420,
    height: 206,
    paddingX: 16,
    paddingY: 14,
    radiusClass: 'rounded-3xl',
  },
  'invite-incoming-connected': {
    // Horizontal "wants to vibe" pill — avatar + copy + two circle
    // actions (X, ✓). Pill shape on purpose so it reads as "incoming
    // notification" not "music card". Width comfortably fits a
    // 32px avatar, ~22ch of copy, and two 36px action circles.
    width: 460,
    height: 72,
    paddingX: 12,
    paddingY: 12,
    radiusClass: 'rounded-full',
  },
  'invite-incoming-disconnected': {
    // Same pill proportions as `invite-incoming-connected` — both
    // recipient states are an "incoming" affordance, just with
    // different actions. Horizontal-only growth from `bar`; no
    // backdrop, no modal feel.
    width: 460,
    height: 64,
    paddingX: 8,
    paddingY: 8,
    radiusClass: 'rounded-full',
  },
  'invite-outgoing-pending': {
    // Mina's "waiting on @alice ⏳" chip — same height as the bar so
    // morph from bar → pending → now-playing reads continuous.
    width: 280,
    height: 32,
    paddingX: 12,
    paddingY: 0,
    radiusClass: 'rounded-full',
  },
  'listen-together-now-playing': {
    // Mirrored playback — same width as expanded-now-playing plus a
    // 20px partner-strip header ("vibing with @mina"). Transport
    // controls are read-only for the viewer; the host gets the full
    // search-enabled now-playing card so this view only renders on
    // the viewer side.
    width: 420,
    height: 226,
    paddingX: 16,
    paddingY: 14,
    radiusClass: 'rounded-3xl',
  },
};
