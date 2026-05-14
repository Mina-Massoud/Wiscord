import type { VoiceStyle } from '@/types/auth';

/**
 * Centralized copy registry. Every user-facing string that can adapt to a
 * voice style lives here, keyed by a dotted path that reads top-down
 * (`page.section.purpose`). One place to audit Gen Z lines, swap a phrase
 * that has aged, or add a third voice (formal, kids, …) later.
 *
 * Deliberately NOT in this registry:
 *  - Aria labels (`aria-label`, `aria-pressed` strings) — accessibility
 *    stays neutral; screen-reader users don't need slang.
 *  - Error messages, system warnings, anything safety-related — slang
 *    where trust matters undermines credibility.
 *  - Onboarding microcopy — too sensitive to translate without review.
 *
 * Keep Gen-Z phrases durable: prefer "lowkey", "lock in", "no cap",
 * "vibe", "the gang", "bestie" over fad terms ("skibidi", "rizz") that
 * date within a quarter.
 */
// Capitalization rules for Gen Z entries:
//  - Headings, labels, buttons → Title Case (matches the surface — same as
//    the default uses).
//  - Full sentences (subtitles, toasts) → sentence case (first letter cap,
//    rest lowercase except proper nouns).
// Articles + short prepositions stay lowercase when not the first word
// (AP-style title case): "Who to Know", "Dipped from the Call".
const COPY = {
  // ── Friends page top bar ──────────────────────────────────────────
  'friends.title': { default: 'Friends', genz: 'The Gang' },
  'friends.tab.online': { default: 'Focusing now', genz: 'Locked In' },
  'friends.tab.all': { default: 'All', genz: 'Everyone' },
  'friends.tab.suggestions': { default: 'Discover', genz: 'Who to Know' },
  'friends.add': { default: 'Add Friend', genz: 'Add Bestie' },

  // ── Voice lounge — channel header ─────────────────────────────────
  'voice.title': { default: 'Voice lounge', genz: 'The Voice Vibe' },

  // ── Voice lounge — pre-join empty state ───────────────────────────
  'voice.idle.subtitle': {
    default: 'Click join to drop into the channel and start talking.',
    genz: 'Tap in to pull up and start yapping.',
  },
  'voice.idle.button': { default: 'Join lounge', genz: 'Pull Up' },

  // ── Voice lounge — post-leave empty state ─────────────────────────
  'voice.left.title': {
    default: 'You left the voice lounge',
    genz: 'You Dipped From the Call',
  },
  'voice.left.subtitle': {
    default: 'No one can hear you. Rejoin to talk again.',
    genz: 'Mic is off the gang. Pull back up to keep yapping.',
  },
  'voice.left.button': { default: 'Rejoin lounge', genz: 'Pull Back Up' },

  // ── Voice lounge — connection toast ───────────────────────────────
  'voice.toast.left': { default: 'Left the voice lounge', genz: 'Dipped from the call' },

  // ── Bottom-left connected card ────────────────────────────────────
  'voicePanel.connected.title': { default: 'Voice Connected', genz: "You're Live" },
  'voicePanel.connecting.title': { default: 'Connecting…', genz: 'Pulling Up…' },
  'voicePanel.reconnecting.title': { default: 'Reconnecting…', genz: 'Rebooting Vibe…' },
} as const;

export type CopyKey = keyof typeof COPY;

export function resolveCopy(key: CopyKey, voiceStyle: VoiceStyle): string {
  const entry = COPY[key];
  return entry[voiceStyle] ?? entry.default;
}
