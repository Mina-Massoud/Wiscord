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
