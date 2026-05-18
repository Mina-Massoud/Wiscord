/**
 * Two views for the AI capsule. Same pattern as `musicCapsuleShapes` —
 * idle is a 26×26 circle, expanded is a wider card. The shell
 * `animate={{ width, height }}` morph + `ISLAND_SHELL_SPRING` lift
 * comes from the shared island animations module.
 */

export interface AiShape {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  radiusClass: string;
}

export type AiView = 'idle' | 'expanded' | 'expanded-with-source';

export const AI_SHAPES: Record<AiView, AiShape> = {
  idle: {
    width: 26,
    height: 26,
    paddingX: 0,
    paddingY: 0,
    radiusClass: 'rounded-full',
  },
  expanded: {
    // Slightly taller than the music card so the suggestion rail
    // shown before the first ask has room to breathe — four
    // single-line use-case rows + header + composer fit cleanly at
    // this height without crowding the streaming-response area
    // once an answer arrives.
    width: 460,
    height: 420,
    paddingX: 16,
    paddingY: 14,
    radiusClass: 'rounded-3xl',
  },
  'expanded-with-source': {
    // Chat column fixed at ~360px (focused conversation strip),
    // source pane takes the rest (~676px) so the embedded
    // CalendarShell and the note viewer have real room. Total:
    // 16 + 360 + 12 + 676 + 16 = 1080. Taller too — the calendar
    // grid reads better at 600 than 540.
    width: 1080,
    height: 600,
    paddingX: 16,
    paddingY: 14,
    radiusClass: 'rounded-3xl',
  },
};
