import { z } from 'zod';

import {
  ACTIVITY_KINDS,
  POMODORO_PHASES,
  WATCH_PARTY_STATES,
  WATCH_SOURCE_KINDS,
} from '../../db/models/VoiceActivity.js';

/** Channels are MongoDB ObjectIds (24 hex chars), not UUIDs. */
const channelId = z.string().regex(/^[a-f0-9]{24}$/i, 'channelId must be an ObjectId');

export const channelIdParam = z.object({
  channelId,
});
export type ChannelIdParam = z.infer<typeof channelIdParam>;

/**
 * Start (or reset) a voice-channel activity. Body shape depends on `kind`:
 *  - `youtube` / `screen-share` → must include `source`
 *  - `notes` / `whiteboard`     → no extra payload (channel-keyed editors)
 *  - `quiz`                     → optional `quizId` (host picks which quiz)
 *  - `pomodoro`                 → optional `totalRounds` (defaults to 4)
 *
 * We model the per-kind shape as a discriminated union so an invalid combo
 * (e.g. `kind: 'notes'` with a `source`) gets rejected at the boundary.
 */
const watchSource = z.object({
  kind: z.enum(WATCH_SOURCE_KINDS),
  url: z.string().url('source.url must be a valid URL').max(2048),
  title: z.string().min(1).max(280).nullable().optional(),
});
export type WatchSource = z.infer<typeof watchSource>;

export const startActivityBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('youtube'), source: watchSource }),
  z.object({ kind: z.literal('screen-share'), source: watchSource }),
  z.object({ kind: z.literal('notes') }),
  z.object({ kind: z.literal('whiteboard') }),
  z.object({
    kind: z.literal('quiz'),
    quizId: z.string().regex(/^[a-f0-9]{24}$/i).nullable().optional(),
  }),
  z.object({
    kind: z.literal('pomodoro'),
    /** Number of rounds in the cycle (1-8). Defaults to 4. */
    totalRounds: z.number().int().min(1).max(8).optional(),
  }),
]);
export type StartActivityBody = z.infer<typeof startActivityBody>;

/**
 * Host-only watch-party control. Only valid when the active activity is a
 * watch kind — the service rejects it otherwise.
 */
export const controlBody = z.object({
  action: z.enum(['play', 'pause', 'seek']),
  timeMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
});
export type ControlBody = z.infer<typeof controlBody>;

/**
 * Pomodoro control surface. Five actions:
 *  - `pause` / `resume` / `skip` → host-only.
 *  - `requestReset`              → any participant. Pins a "X wants to start
 *                                  fresh" banner in the host's UI for ~30s.
 *  - `respondReset`              → host-only. Accept (timer resets to fresh
 *                                  25-min focus) or decline (request cleared).
 *
 * Validated as a discriminated union so callers can't pass `requestReset`
 * with stray fields.
 */
export const pomodoroControlBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
  z.object({ action: z.literal('skip') }),
  z.object({ action: z.literal('requestReset') }),
  z.object({ action: z.literal('respondReset'), accept: z.boolean() }),
]);
export type PomodoroControlBody = z.infer<typeof pomodoroControlBody>;

export const transferHostBody = z.object({
  toUserId: z.string().min(1).max(64),
});
export type TransferHostBody = z.infer<typeof transferHostBody>;

/**
 * Per-user activity presence update — declares "I am viewing kind X" (or
 * "I'm back on the voice grid" when `kind` is null). The server piggybacks
 * the value onto voice presence so other participants see it in real time.
 */
export const setPresenceBody = z.object({
  kind: z.enum(ACTIVITY_KINDS).nullable(),
});
export type SetPresenceBody = z.infer<typeof setPresenceBody>;

/**
 * Host-only quiz pin. Sets `quizId` on a running quiz activity so the embed
 * shows that quiz to everyone in the channel.
 */
export const pinQuizBody = z.object({
  quizId: z.string().regex(/^[a-f0-9]{24}$/i).nullable(),
});
export type PinQuizBody = z.infer<typeof pinQuizBody>;

/**
 * Pomodoro-specific slice of the activity snapshot. Only populated when
 * `kind === 'pomodoro'`; otherwise `null`. Times go over the wire as ISO
 * strings — clients compute remaining-ms locally from `endsAt`.
 */
export const pomodoroSnapshotSchema = z.object({
  phase: z.enum(POMODORO_PHASES),
  round: z.number().int(),
  totalRounds: z.number().int(),
  /** Server-anchored end time of the current phase. null while paused. */
  endsAt: z.string().nullable(),
  /** Remaining ms snapshotted at pause. null while running. */
  pausedRemainingMs: z.number().int().nullable(),
  /** Pending reset request from a non-host participant. */
  resetRequest: z
    .object({
      byUserId: z.string(),
      requestedAt: z.string(),
    })
    .nullable(),
});
export type PomodoroSnapshot = z.infer<typeof pomodoroSnapshotSchema>;

/**
 * Wire-format snapshot. The discriminated frontend type lives in
 * `frontend/src/queries/client.ts` and mirrors these field names — keep them
 * aligned when adding new kinds.
 */
export const voiceActivityResponseSchema = z.object({
  channelId: z.string(),
  kind: z.enum(ACTIVITY_KINDS),
  hostUserId: z.string(),
  startedAt: z.string(),
  source: z
    .object({
      kind: z.enum(WATCH_SOURCE_KINDS),
      url: z.string(),
      title: z.string().nullable(),
    })
    .nullable(),
  state: z.enum(WATCH_PARTY_STATES).nullable(),
  currentTimeMs: z.number(),
  lastTickAt: z.string().nullable(),
  quizId: z.string().nullable(),
  pomodoro: pomodoroSnapshotSchema.nullable(),
});
export type VoiceActivityResponse = z.infer<typeof voiceActivityResponseSchema>;
