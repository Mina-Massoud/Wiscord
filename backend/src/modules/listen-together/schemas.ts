import { z } from 'zod';

/**
 * Wire shapes for the "Listen Together" module. Invites and sessions are
 * fully ephemeral (in-memory `sessionStore`) — no Mongoose model — so the
 * DTO types live here too instead of in `db/models/`.
 */

const objectIdField = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

const inviteIdField = z
  .string()
  .regex(/^lt_[a-z0-9]{16}$/, 'Invalid invite id');

const sessionIdField = z
  .string()
  .regex(/^lts_[a-z0-9]{16}$/, 'Invalid session id');

// MusicTrack mirrors `frontend/src/types/music.ts`. Keep the field names in
// lock-step — the host hands us the track they're currently playing, and the
// viewer's iframe loads it directly.
const musicTrackInput = z
  .object({
    videoId: z
      .string()
      .min(6)
      .max(32)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid videoId'),
    title: z.string().min(1).max(300),
    artist: z.string().max(300),
    thumbnailUrl: z.string().url().max(2048),
    durationSeconds: z.number().int().min(0).max(60 * 60 * 12).nullable(),
  })
  .strict();
export type MusicTrackInput = z.infer<typeof musicTrackInput>;

export const sendInviteBody = z
  .object({
    toUserId: objectIdField,
    track: musicTrackInput,
  })
  .strict();
export type SendInviteBody = z.infer<typeof sendInviteBody>;

export const inviteIdParam = z.object({ id: inviteIdField });
export type InviteIdParam = z.infer<typeof inviteIdParam>;

export const sessionIdParam = z.object({ id: sessionIdField });
export type SessionIdParam = z.infer<typeof sessionIdParam>;

export const playbackBody = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('play'),
        hostProgressMs: z.number().int().min(0),
      })
      .strict(),
    z
      .object({
        kind: z.literal('pause'),
        hostProgressMs: z.number().int().min(0),
      })
      .strict(),
    z
      .object({
        kind: z.literal('seek'),
        ms: z.number().int().min(0),
        hostProgressMs: z.number().int().min(0),
      })
      .strict(),
    z
      .object({
        kind: z.literal('track_changed'),
        track: musicTrackInput,
        hostProgressMs: z.number().int().min(0),
      })
      .strict(),
  ]);
export type PlaybackBody = z.infer<typeof playbackBody>;

// ── DTO shapes (wire format) ──────────────────────────────────────────────

export interface ListenTogetherUserDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ListenTogetherTrackDto {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
}

export interface ListenTogetherInviteDto {
  id: string;
  /** The user who sent the invite. */
  from: ListenTogetherUserDto;
  /** The user the invite is addressed to. */
  to: ListenTogetherUserDto;
  track: ListenTogetherTrackDto;
  /** ISO timestamp — 60s past `createdAt`. */
  expiresAt: string;
  createdAt: string;
}

export interface ListenTogetherSessionDto {
  id: string;
  /** Always the user who sent the original invite. */
  host: ListenTogetherUserDto;
  /** Always the user who accepted. */
  viewer: ListenTogetherUserDto;
  track: ListenTogetherTrackDto;
  /** ISO. */
  startedAt: string;
}

export type ListenTogetherPlaybackKind =
  | 'play'
  | 'pause'
  | 'seek'
  | 'track_changed';

export interface ListenTogetherPlaybackDto {
  sessionId: string;
  kind: ListenTogetherPlaybackKind;
  /** Present when kind === 'seek'. */
  ms: number | null;
  /** Present when kind === 'track_changed'. */
  track: ListenTogetherTrackDto | null;
  /** Host's playhead at emit time. Viewers snap to this on large drift. */
  hostProgressMs: number;
  /** ISO. */
  emittedAt: string;
}
