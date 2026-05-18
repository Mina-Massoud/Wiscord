/**
 * Wiscord AI voice — registry. Picks the right voice bundle per user
 * vibe and exposes `composeSystemPrompt(scopeRules, vibe)` for callers.
 *
 * Why a registry instead of one giant prompt string with branches:
 *   Gemini's implicit prefix cache hits when the *same object reference*
 *   for `prefillContents` is passed across requests. If we built the
 *   prefill list per-request from a user's vibe, every call would be a
 *   fresh allocation and the cache would miss — roughly 3× the cost on
 *   the prompt-token side. By caching one `prefillContents` array per
 *   vibe at module load and re-using that reference, we keep the prefix
 *   cache working AND let each user see their preferred voice.
 *
 * Adding a vibe means writing one new `voice-<name>.ts` module that
 * exports `{ VOICE_RULES, PREFILL_TURNS }` and registering it here.
 */

import { type Content } from '@google/genai';

import * as genz from './voice-genz.js';
import * as chill from './voice-chill.js';
import * as professional from './voice-professional.js';
import type { Vibe, VoicePrefillTurn } from './voice-types.js';

export type { Vibe, VoicePrefillTurn };

interface VoiceBundle {
  /** Static system-prompt rules (register, length, banned reflexes,
   *  modes). Layered with the scope rules in `composeSystemPrompt`. */
  voiceRules: string;
  /** Few-shot anchors as Gemini Content turn pairs. Stable reference
   *  per vibe — DO NOT rebuild this array per request. */
  prefillContents: Content[];
}

/**
 * Build a Content[] once from a list of prefill turns. Called eagerly
 * for each vibe at module load; the resulting reference is reused on
 * every `getVoiceBundle(vibe)` call so the prefix cache can amortize
 * the prompt-token cost across users on the same vibe.
 */
function buildPrefillContents(turns: VoicePrefillTurn[]): Content[] {
  return turns.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));
}

const REGISTRY: Record<Vibe, VoiceBundle> = {
  genz: {
    voiceRules: genz.VOICE_RULES,
    prefillContents: buildPrefillContents(genz.PREFILL_TURNS),
  },
  chill: {
    voiceRules: chill.VOICE_RULES,
    prefillContents: buildPrefillContents(chill.PREFILL_TURNS),
  },
  professional: {
    voiceRules: professional.VOICE_RULES,
    prefillContents: buildPrefillContents(professional.PREFILL_TURNS),
  },
};

const VALID_VIBES: ReadonlySet<Vibe> = new Set<Vibe>(['genz', 'chill', 'professional']);

function isVibe(value: string | undefined | null): value is Vibe {
  return typeof value === 'string' && (VALID_VIBES as ReadonlySet<string>).has(value);
}

/**
 * Look up the voice bundle for `vibe`. Falls back to `genz` (the
 * historic Wiscord default) when the value is missing or unknown so
 * legacy callers that don't yet thread the user's vibe still get a
 * working prompt rather than a crash.
 */
export function getVoiceBundle(vibe: Vibe | string | undefined | null): VoiceBundle {
  return REGISTRY[isVibe(vibe) ? vibe : 'genz'];
}

/**
 * Compose the system instruction for any scope.
 *
 * `vibe` selects which voice rules block sits ABOVE the scope rules.
 * Falls back to `genz` for legacy callers. The few-shot anchors do
 * NOT live in the system prompt — they're prepended to the `contents`
 * array via the bundle's `prefillContents` by `service.ts`.
 *
 * @param scopeRules - The scope-specific rules block: which sources
 *   to read from, which citation forms are valid, scope-specific
 *   guardrails. Stays vibe-neutral; register lives in the voice rules.
 * @param vibe       - Which voice register to use. Defaults to `genz`.
 */
export function composeSystemPrompt(
  scopeRules: string,
  vibe: Vibe | string | undefined | null = 'genz',
): string {
  const bundle = getVoiceBundle(vibe);
  return `${bundle.voiceRules}\n\n${scopeRules}`;
}
