import type { Vibe } from '@/types/auth';

/**
 * Centralized copy registry. Every user-facing string that can adapt to a
 * voice vibe lives here, keyed by a dotted path that reads top-down
 * (`page.section.purpose`).
 *
 * Three vibes, one column each:
 *  - `genz`         — default for students; dry, lowkey, group-chat energy.
 *  - `chill`        — friendly mate, no slang, no profanity. Neutral.
 *  - `professional` — default for teachers; complete sentences, no slang,
 *                     no emojis. Safe for any audience.
 *
 * Deliberately NOT in this registry:
 *  - Aria labels (`aria-label`, `aria-pressed`) — accessibility stays
 *    neutral; screen-reader users don't need slang.
 *  - Onboarding microcopy — handled by the dedicated onboarding pages
 *    so the same screen reads coherently end-to-end.
 *
 * Keep Gen-Z phrases durable: prefer "lowkey", "lock in", "no cap",
 * "vibe", "the gang", "bestie" over fad terms ("skibidi", "rizz") that
 * date within a quarter.
 */
// Capitalization rules per vibe:
//  - genz: Title Case for headings/buttons; sentence case for sentences.
//  - chill: matches genz capitalization, plain words.
//  - professional: Standard Title Case for headings/buttons, full
//    sentences with sentence case. No lowercase-start informalities.
const COPY = {
  // ── Friends page top bar ──────────────────────────────────────────
  'friends.title': { genz: 'The Gang', chill: 'Friends', professional: 'Friends' },
  'friends.tab.online': {
    genz: 'Locked In',
    chill: 'Focusing now',
    professional: 'Focusing now',
  },
  'friends.tab.all': { genz: 'Everyone', chill: 'All', professional: 'All' },
  'friends.tab.pending': { genz: 'On Pending', chill: 'Pending', professional: 'Pending' },
  'friends.add': { genz: 'Add Bestie', chill: 'Add Friend', professional: 'Add Friend' },
  'friends.empty.online.title': {
    genz: 'The gang is touching grass.',
    chill: "Nobody's around right now.",
    professional: 'No one is focusing right now.',
  },
  'friends.empty.online.body': {
    genz: 'Your besties are off the grid. Ping them later to lock in together.',
    chill: "Your friends are offline. Catch them when they're back.",
    professional: 'Your contacts are offline. Reach out when they return.',
  },
  'friends.empty.all.title': {
    genz: 'The gang is empty rn.',
    chill: 'No study buddies yet.',
    professional: 'You have no contacts yet.',
  },
  'friends.empty.all.body': {
    genz: 'Add a bestie to start locking in together.',
    chill: 'Send a friend request to start studying together.',
    professional: 'Send a friend request to start working together.',
  },
  'friends.empty.cta': {
    genz: 'Add a Bestie',
    chill: 'Add a friend',
    professional: 'Add a friend',
  },
  'friends.empty.incoming.title': {
    genz: 'Inbox is dry.',
    chill: 'No incoming requests.',
    professional: 'No incoming requests.',
  },
  'friends.empty.outgoing.title': {
    genz: "You haven't slid in anywhere.",
    chill: "You haven't sent any requests.",
    professional: 'You have not sent any requests.',
  },
  'friends.add.title': {
    genz: 'Add a Bestie',
    chill: 'Add Friend',
    professional: 'Add Friend',
  },
  'friends.add.subtitle': {
    genz: "Drop their @ and we'll send the slide.",
    chill: 'Send a friend request by username.',
    professional: 'Send a friend request by username.',
  },
  'friends.add.placeholder': {
    genz: 'their @',
    chill: 'Enter a username',
    professional: 'Enter a username',
  },
  'friends.add.cta': {
    genz: 'Slide In',
    chill: 'Send Friend Request',
    professional: 'Send Friend Request',
  },
  'friends.add.success': {
    genz: 'Slid into @{username}.',
    chill: 'Friend request sent to @{username}.',
    professional: 'Friend request sent to @{username}.',
  },
  'friends.add.accepted': {
    genz: 'Bestie locked in with @{username}.',
    chill: 'You and @{username} are now friends.',
    professional: 'You and @{username} are now connected.',
  },
  'friends.row.message': { genz: 'DM', chill: 'Message', professional: 'Message' },
  'friends.row.more': { genz: 'Options', chill: 'More', professional: 'More' },
  'friends.row.remove': {
    genz: 'Drop the bestie',
    chill: 'Remove friend',
    professional: 'Remove contact',
  },
  'friends.row.accept': { genz: 'Pull Up', chill: 'Accept', professional: 'Accept' },
  'friends.row.decline': { genz: 'Decline', chill: 'Decline', professional: 'Decline' },
  'friends.row.cancel': { genz: 'Take Back', chill: 'Cancel', professional: 'Cancel' },
  'friends.remove.confirm.title': {
    genz: 'Drop the bestie?',
    chill: 'Remove friend?',
    professional: 'Remove this contact?',
  },
  'friends.remove.confirm.body': {
    genz: 'You can always slide back in later.',
    chill: 'You can always send a new request later.',
    professional: 'You can send a new request later if you change your mind.',
  },
  'friends.toast.sent': {
    genz: 'Slid in.',
    chill: 'Request sent.',
    professional: 'Request sent.',
  },
  'friends.toast.accepted': {
    genz: 'Bestie locked in.',
    chill: 'Friend added.',
    professional: 'Contact added.',
  },
  'friends.toast.removed': {
    genz: 'Dropped the bestie.',
    chill: 'Friend removed.',
    professional: 'Contact removed.',
  },

  // ── Home / friends right-rail showcase ────────────────────────────
  // Static product copy (not live data). Lives in the registry so it
  // reads as intentional content and adapts to the user's vibe.
  'home.announcement.tag': { genz: 'New', chill: 'New', professional: 'New' },
  'home.announcement.headline': {
    genz: 'Room AI now cites the chat.',
    chill: 'Room AI now cites the chat.',
    professional: 'Room AI now cites the chat.',
  },
  'home.announcement.tagline': {
    genz: 'Ask the room anything — answers link straight back to the exact message.',
    chill: 'Ask anything about your room — answers link back to the exact message.',
    professional: 'Ask a question about your room and answers link back to the exact message.',
  },
  'home.spotlight.title': {
    genz: 'Sync Timer',
    chill: 'Sync timer',
    professional: 'Sync timer',
  },
  'home.spotlight.blurb': {
    genz: 'Start a Pomodoro and the whole room locks in and counts down with you.',
    chill: 'Start a Pomodoro and the whole room counts down with you.',
    professional: 'Start a Pomodoro and the entire room counts down together.',
  },

  // ── Voice lounge — channel header ─────────────────────────────────
  'voice.title': { genz: 'The Voice Vibe', chill: 'Voice lounge', professional: 'Voice channel' },

  // ── Voice lounge — pre-join empty state ───────────────────────────
  'voice.idle.subtitle': {
    genz: 'Tap in to pull up and start yapping.',
    chill: 'Click join to drop into the channel and start talking.',
    professional: 'Join the channel to start talking with others.',
  },
  'voice.idle.button': { genz: 'Pull Up', chill: 'Join lounge', professional: 'Join channel' },

  // ── Voice lounge — post-leave empty state ─────────────────────────
  'voice.left.title': {
    genz: 'You Dipped From the Call',
    chill: 'You left the voice lounge',
    professional: 'You left the voice channel',
  },
  'voice.left.subtitle': {
    genz: 'Mic is off the gang. Pull back up to keep yapping.',
    chill: 'No one can hear you. Rejoin to talk again.',
    professional: 'Your microphone is off. Rejoin the channel to continue.',
  },
  'voice.left.button': {
    genz: 'Pull Back Up',
    chill: 'Rejoin lounge',
    professional: 'Rejoin channel',
  },

  // ── Voice lounge — connection toast ───────────────────────────────
  'voice.toast.left': {
    genz: 'Dipped from the call',
    chill: 'Left the voice lounge',
    professional: 'Left the voice channel',
  },

  // ── Bottom-left connected card ────────────────────────────────────
  'voicePanel.connected.title': {
    genz: 'Voice Connected',
    chill: 'Voice connected',
    professional: 'Voice connected',
  },
  'voicePanel.connecting.title': {
    genz: 'Pulling Up…',
    chill: 'Connecting…',
    professional: 'Connecting…',
  },
  'voicePanel.reconnecting.title': {
    genz: 'Rebooting Vibe…',
    chill: 'Reconnecting…',
    professional: 'Reconnecting…',
  },
} as const;

export type CopyKey = keyof typeof COPY;

/**
 * Resolve `key` for the given `vibe`. The registry is exhaustive over
 * the three vibes by construction (TS would yell if a column went
 * missing), so no runtime fallback is needed — but we keep a safety
 * net to `genz` for any legacy code path that might pass an unknown
 * value at runtime.
 */
export function resolveCopy(key: CopyKey, vibe: Vibe): string {
  const entry = COPY[key];
  return entry[vibe] ?? entry.genz;
}
