import {
  ListChecks,
  MonitorUp,
  NotebookPen,
  PenLine,
  Timer,
  Youtube,
  type LucideIcon,
} from 'lucide-react';

import type { ActivityKind } from '@/queries/client';

/**
 * Static plugin-style registry of voice-channel activities. Adding a sixth
 * activity is one entry here plus one case in `ActivityRenderer`'s switch —
 * no other code needs to change.
 *
 * Each entry has:
 *  - `kind`   — discriminator the server, registry, dispatcher all share
 *  - `title`  — sentence-case display label
 *  - `blurb`  — one-sentence pitch shown under the cover
 *  - `icon`   — literal lucide glyph for the metadata strip (per CLAUDE.md,
 *               never a magic/Sparkles icon on non-AI surfaces)
 *  - `cover`  — visual spec for the tile cover (gradient + large glyph)
 *  - `status` — `'available'` (rendered live) or `'coming-soon'` (visible
 *               but disabled tile, helps the registry stay honest while
 *               we wire the activity in)
 */
export interface ActivityCover {
  /**
   * CSS `background-image` for the cover. A radial gradient with three
   * hue stops gives every tile a distinct signature beat. Keep the inner
   * stop bright and the outer stop close to canvas so tiles don't shout.
   */
  gradient: string;
  /** Big literal glyph centered in the cover. */
  glyph: LucideIcon;
}

export interface ActivityDefinition {
  kind: ActivityKind;
  title: string;
  blurb: string;
  icon: LucideIcon;
  cover: ActivityCover;
  status: 'available' | 'coming-soon';
}

export const ACTIVITY_REGISTRY: readonly ActivityDefinition[] = [
  {
    kind: 'youtube',
    title: 'YouTube',
    blurb: 'Sync a YouTube video with everyone in voice.',
    icon: Youtube,
    cover: {
      gradient: 'radial-gradient(circle at 30% 35%, #F4365B 0%, #5C0E22 45%, #0A0A0C 100%)',
      glyph: Youtube,
    },
    status: 'available',
  },
  {
    kind: 'screen-share',
    title: 'Screen share',
    blurb: 'Share a window or tab — everyone watches live.',
    icon: MonitorUp,
    cover: {
      gradient: 'radial-gradient(circle at 30% 35%, #38BDF8 0%, #0C4A6E 45%, #0A0A0C 100%)',
      glyph: MonitorUp,
    },
    status: 'available',
  },
  {
    kind: 'notes',
    title: 'Notes',
    blurb: 'Write together in a shared, realtime note.',
    icon: NotebookPen,
    cover: {
      gradient: 'radial-gradient(circle at 30% 35%, #F4B942 0%, #6B3A05 45%, #0A0A0C 100%)',
      glyph: NotebookPen,
    },
    status: 'available',
  },
  {
    kind: 'whiteboard',
    title: 'Whiteboard',
    blurb: 'Draw and diagram on a shared canvas.',
    icon: PenLine,
    cover: {
      gradient: 'radial-gradient(circle at 30% 35%, #34D399 0%, #064E3B 45%, #0A0A0C 100%)',
      glyph: PenLine,
    },
    status: 'available',
  },
  {
    kind: 'quiz',
    title: 'Quiz',
    blurb: 'Run a quiz for the room — host-led, live answers.',
    icon: ListChecks,
    cover: {
      gradient: 'radial-gradient(circle at 30% 35%, #8B5CF6 0%, #2E1065 45%, #0A0A0C 100%)',
      glyph: ListChecks,
    },
    status: 'available',
  },
  {
    kind: 'pomodoro',
    title: 'Focus session',
    blurb: '25-min focus + 5-min break, synced for everyone in voice.',
    icon: Timer,
    cover: {
      gradient: 'radial-gradient(circle at 30% 35%, #5865F2 0%, #1F2050 45%, #0A0A0C 100%)',
      glyph: Timer,
    },
    status: 'available',
  },
] as const;

export function findActivity(kind: ActivityKind): ActivityDefinition | undefined {
  return ACTIVITY_REGISTRY.find((a) => a.kind === kind);
}
