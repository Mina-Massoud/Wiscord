import type { MusicTrack } from './music';

/**
 * Wire shapes for the Listen-Together flow. These mirror the backend's
 * `modules/listen-together/schemas.ts` DTOs — keep them in lock-step.
 */

export interface ListenTogetherUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ListenTogetherInvite {
  id: string;
  from: ListenTogetherUser;
  to: ListenTogetherUser;
  track: MusicTrack;
  /** ISO — 60s past `createdAt`. */
  expiresAt: string;
  createdAt: string;
}

export interface ListenTogetherSession {
  id: string;
  host: ListenTogetherUser;
  viewer: ListenTogetherUser;
  track: MusicTrack;
  startedAt: string;
}

export type ListenTogetherRole = 'host' | 'viewer';

export type ListenTogetherPlaybackKind = 'play' | 'pause' | 'seek' | 'track_changed';

export interface ListenTogetherPlayback {
  sessionId: string;
  kind: ListenTogetherPlaybackKind;
  /** Present when kind === 'seek'. */
  ms: number | null;
  /** Present when kind === 'track_changed'. */
  track: MusicTrack | null;
  hostProgressMs: number;
  emittedAt: string;
}

// ── Realtime event payloads ────────────────────────────────────────────

export interface ListenTogetherInviteSentEvent {
  toUserId: string;
  invite: ListenTogetherInvite;
}

export interface ListenTogetherInviteResolvedEvent {
  toUserId: string;
  inviteId: string;
  outcome: 'accepted' | 'declined' | 'expired';
  session: ListenTogetherSession | null;
}

export interface ListenTogetherSessionEndedEvent {
  toUserId: string;
  sessionId: string;
  endedBy: string;
  reason: 'left' | 'replaced' | 'disconnected';
}

export interface ListenTogetherPlaybackEvent {
  toUserId: string;
  playback: ListenTogetherPlayback;
}
