/**
 * Shared types for the per-vibe voice bundles. Kept in their own file
 * so each bundle (`voice-genz.ts`, `voice-chill.ts`, `voice-professional.ts`)
 * stays a pure data module — only static strings — and `voice.ts` can
 * import the bundles without dragging the rest of the AI module graph
 * into a circular import.
 */

export interface VoicePrefillTurn {
  role: 'user' | 'model';
  text: string;
}

/**
 * Three discrete vibes for v1. Locked to a finite set because each
 * vibe needs its own statically-built `prefillContents` array (one
 * reference per vibe, reused across requests) for Gemini's implicit
 * prefix cache to hit.
 */
export type Vibe = 'genz' | 'chill' | 'professional';
