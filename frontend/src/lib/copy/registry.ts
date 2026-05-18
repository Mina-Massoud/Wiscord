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
  'friends.tab.pending': { default: 'Pending', genz: 'On Pending' },
  'friends.add': { default: 'Add Friend', genz: 'Add Bestie' },
  'friends.empty.online.title': {
    default: "Nobody's locked in right now.",
    genz: 'The gang is touching grass.',
  },
  'friends.empty.online.body': {
    default: "Your friends are offline or off study mode. Catch them when they're back.",
    genz: 'Your besties are off the grid. Ping them later to lock in together.',
  },
  'friends.empty.all.title': {
    default: 'No study buddies yet.',
    genz: 'The gang is empty rn.',
  },
  'friends.empty.all.body': {
    default: 'Send a friend request to start studying together.',
    genz: 'Add a bestie to start locking in together.',
  },
  'friends.empty.cta': { default: 'Add a friend', genz: 'Add a Bestie' },
  'friends.empty.incoming.title': {
    default: 'No incoming requests.',
    genz: 'Inbox is dry.',
  },
  'friends.empty.outgoing.title': {
    default: "You haven't sent any requests.",
    genz: "You haven't slid in anywhere.",
  },
  'friends.add.title': {
    default: 'Add Friend',
    genz: 'Add a Bestie',
  },
  'friends.add.subtitle': {
    default: 'You can add a friend with their username.',
    genz: "Drop their @ and we'll send the slide.",
  },
  'friends.add.placeholder': {
    default: 'Enter a username',
    genz: 'their @',
  },
  'friends.add.cta': { default: 'Send Friend Request', genz: 'Slide In' },
  'friends.add.success': {
    default: 'Friend request sent to @{username}.',
    genz: 'Slid into @{username}.',
  },
  'friends.add.accepted': {
    default: 'You and @{username} are now friends.',
    genz: 'Bestie locked in with @{username}.',
  },
  'friends.row.message': { default: 'Message', genz: 'DM' },
  'friends.row.more': { default: 'More', genz: 'Options' },
  'friends.row.remove': { default: 'Remove friend', genz: 'Drop the bestie' },
  'friends.row.accept': { default: 'Accept', genz: 'Pull Up' },
  'friends.row.decline': { default: 'Decline', genz: 'Decline' },
  'friends.row.cancel': { default: 'Cancel', genz: 'Take Back' },
  'friends.remove.confirm.title': {
    default: 'Remove friend?',
    genz: 'Drop the bestie?',
  },
  'friends.remove.confirm.body': {
    default: 'You can always send a new request later.',
    genz: 'You can always slide back in later.',
  },
  'friends.toast.sent': {
    default: 'Request sent.',
    genz: 'Slid in.',
  },
  'friends.toast.accepted': {
    default: 'Friend added.',
    genz: 'Bestie locked in.',
  },
  'friends.toast.removed': {
    default: 'Friend removed.',
    genz: 'Dropped the bestie.',
  },

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
  'voicePanel.connected.title': { default: 'Voice Connected', genz: 'Voice Connected' },
  'voicePanel.connecting.title': { default: 'Connecting…', genz: 'Pulling Up…' },
  'voicePanel.reconnecting.title': { default: 'Reconnecting…', genz: 'Rebooting Vibe…' },
} as const;

export type CopyKey = keyof typeof COPY;

export function resolveCopy(key: CopyKey, voiceStyle: VoiceStyle): string {
  const entry = COPY[key];
  return entry[voiceStyle] ?? entry.default;
}
