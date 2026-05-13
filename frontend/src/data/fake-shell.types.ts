/**
 * Static fake-data shapes for the post-login app shell.
 * These types are pure data — no React, no I/O.
 */

export type Presence = 'online' | 'idle' | 'dnd' | 'offline';

export interface FakeUser {
  id: string;
  username: string;
  displayName: string;
  /** Seed for getIdenticonDataUrl — usually equals username. */
  avatarSeed: string;
  presence: Presence;
  /** Optional inline status under the name (e.g. "with three.js"). */
  status?: string;
  isBot?: boolean;
}

export type FakeMessageKind = 'message' | 'system-join';

export interface FakeMessage {
  id: string;
  authorId: string;
  /** ISO 8601 UTC. Rendered via Intl. */
  timestamp: string;
  body: string;
  kind: FakeMessageKind;
}

export type FakeChannelKind = 'text' | 'voice';

export interface FakeChannel {
  id: string;
  kind: FakeChannelKind;
  name: string;
  messages: FakeMessage[];
}

export interface FakeServer {
  id: string;
  name: string;
  /** Seed for getIdenticonDataUrl — usually equals id. */
  iconSeed: string;
  hasUnread?: boolean;
  /** When set, renders as a red badge over the icon. */
  unreadCount?: number;
  channels: FakeChannel[];
}

/**
 * A row in the "Recent rooms" list — a channel inside a server you've
 * recently been in. v1 has no 1:1 DMs (see docs/overview.md), so the
 * left-rail list surfaces *rooms*, not people.
 */
export interface FakeRecentRoom {
  id: string;
  serverId: string;
  serverName: string;
  serverIconSeed: string;
  channelId: string;
  channelName: string;
  channelKind: FakeChannelKind;
  hasUnread?: boolean;
  unreadCount?: number;
}

export interface FakeFriend {
  user: FakeUser;
}

/**
 * Room currently in a synchronized focus session. Surfaced in the right-rail
 * "Focusing now" list so a quiet day still telegraphs the core loop
 * (synchronized Pomodoro + body-doubling).
 */
export interface FakeFocusingRoom {
  id: string;
  serverId: string;
  serverName: string;
  serverIconSeed: string;
  channelId: string;
  channelName: string;
  channelKind: FakeChannelKind;
  /** People currently in the session — drives the trailing "N focusing" count. */
  focusCount: number;
  /** Minutes left in the active block. Display only — no live tick in v1. */
  minutesLeft: number;
}

/**
 * Room surfaced as a discovery suggestion under "Find your room" in the
 * right rail. Blurb explains what the room is for in one sentence.
 */
export interface FakeSuggestedRoom {
  id: string;
  serverId: string;
  serverName: string;
  serverIconSeed: string;
  channelId: string;
  channelName: string;
  channelKind: FakeChannelKind;
  blurb: string;
}

export type FeatureSpotlightIcon = 'timer' | 'voice' | 'notes' | 'ai';

/**
 * One-of-many highlight card pinned to the top of the right rail. Always
 * present so empty sessions still showcase a Wiscord differentiator.
 */
export interface FeatureSpotlight {
  id: string;
  icon: FeatureSpotlightIcon;
  title: string;
  blurb: string;
}

/**
 * "New" banner rendered below the friends list. Tag + headline + tagline.
 * Decorative in v1 — the arrow affords interactivity but the row does not
 * route anywhere (see the pure-static wiring decision in the panel plan).
 */
export interface FakeAnnouncement {
  id: string;
  tag: string;
  headline: string;
  tagline: string;
}

/**
 * Single tip card in the showcase row under the friends list. Reuses the
 * FeatureSpotlightIcon vocabulary so tip icons stay consistent with the
 * right-rail spotlight chip.
 */
export interface FakeTipHint {
  id: string;
  icon: FeatureSpotlightIcon;
  title: string;
  blurb: string;
}
