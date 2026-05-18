import { Schema, model, type HydratedDocument } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * One active voice-channel activity at a time. Replaces the old `WatchParty`
 * doc — voice channels can now run more than just video sync, but they still
 * run exactly one activity at a time (a channel can't be both watching a
 * YouTube video and using the whiteboard simultaneously — that's two
 * sessions, mentally).
 *
 * Schema is intentionally flat with a `kind` discriminator and nullable
 * per-kind fields. A discriminated Mongoose schema would be cleaner, but
 * Mongoose 9 + strict TS makes them painful and the savings here aren't
 * worth the friction. The Zod schema in `voice-activity/schemas.ts` does the
 * real shape enforcement at the route boundary.
 *
 * `kind` semantics:
 *  - `'youtube'` / `'screen-share'` — watch-party kinds. Use `sourceKind`,
 *    `sourceUrl`, `sourceTitle`, `state`, `currentTimeMs`, `lastTickAt`.
 *  - `'notes'` / `'whiteboard'` — collaborative editor kinds. The underlying
 *    doc lives in `ChannelNotes` / `ChannelWhiteboard`, keyed by `channelId`.
 *    No extra state stored here — the activity doc is just a "this channel
 *    is currently looking at the whiteboard" signal.
 *  - `'quiz'` — quiz activity. `quizId` points at the broadcasted quiz (or
 *    null while the host is picking).
 *  - `'pomodoro'` — shared focus session. Uses `pomoPhase`, `pomoRound`,
 *    `pomoTotalRounds`, `pomoEndsAt`, `pomoPausedRemainingMs`, plus
 *    `pomoResetRequestBy` / `pomoResetRequestedAt` for the reset-request
 *    flow (a non-host participant can ask the host to reset the timer; the
 *    host accepts or declines).
 *
 * The host (`hostUserId`) is whoever started the activity. They're the only
 * one allowed to end it, switch sources, or control playback / pomodoro.
 */
export const ACTIVITY_KINDS = [
  'youtube',
  'screen-share',
  'notes',
  'whiteboard',
  'quiz',
  'pomodoro',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const WATCH_SOURCE_KINDS = ['youtube', 'direct', 'screen'] as const;
export type WatchSourceKind = (typeof WATCH_SOURCE_KINDS)[number];

export const WATCH_PARTY_STATES = ['idle', 'playing', 'paused'] as const;
export type WatchPartyState = (typeof WATCH_PARTY_STATES)[number];

export const POMODORO_PHASES = ['focus', 'break'] as const;
export type PomodoroPhase = (typeof POMODORO_PHASES)[number];

/**
 * Explicit shape — declared by hand to dodge Mongoose 9's
 * `InferSchemaType` "excessively deep" error on nullable enum fields.
 * Same trick `Quiz.ts` uses.
 */
export interface VoiceActivityShape {
  channelId: string;
  kind: ActivityKind;
  hostUserId: string;
  startedAt: Date;
  sourceKind: WatchSourceKind | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  state: WatchPartyState | null;
  currentTimeMs: number;
  lastTickAt: Date | null;
  quizId: string | null;
  // Pomodoro fields — populated only when kind === 'pomodoro'.
  pomoPhase: PomodoroPhase | null;
  pomoRound: number | null;
  pomoTotalRounds: number | null;
  /** Server-anchored end time of the current phase. null while paused. */
  pomoEndsAt: Date | null;
  /** Remaining ms snapshotted at pause time. null while running. */
  pomoPausedRemainingMs: number | null;
  /** Single-slot reset request from a non-host participant. The host
   *  sees these inline and accepts/declines. Auto-clears at 30s. */
  pomoResetRequestBy: string | null;
  pomoResetRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const voiceActivitySchema = new Schema(
  {
    channelId: { type: String, required: true, unique: true },
    kind: { type: String, enum: ACTIVITY_KINDS, required: true },
    hostUserId: { type: String, required: true },
    startedAt: { type: Date, required: true, default: () => new Date() },

    // Watch-party fields — only populated when kind ∈ {'youtube','screen-share'}.
    sourceKind: { type: String, enum: WATCH_SOURCE_KINDS, default: null },
    sourceUrl: { type: String, default: null },
    sourceTitle: { type: String, default: null },
    state: { type: String, enum: WATCH_PARTY_STATES, default: null },
    currentTimeMs: { type: Number, default: 0 },
    lastTickAt: { type: Date, default: () => new Date() },

    // Quiz field — only populated when kind === 'quiz' and the host has
    // picked which quiz to broadcast.
    quizId: { type: String, default: null },

    // Pomodoro fields — only populated when kind === 'pomodoro'.
    pomoPhase: { type: String, enum: POMODORO_PHASES, default: null },
    pomoRound: { type: Number, default: null, min: 1, max: 32 },
    pomoTotalRounds: { type: Number, default: null, min: 1, max: 32 },
    pomoEndsAt: { type: Date, default: null },
    pomoPausedRemainingMs: { type: Number, default: null, min: 0 },
    pomoResetRequestBy: { type: String, default: null },
    pomoResetRequestedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'voice_activities' },
);

applySerialize(voiceActivitySchema);

export type VoiceActivityDoc = HydratedDocument<VoiceActivityShape>;
export const VoiceActivity = model<VoiceActivityShape>('VoiceActivity', voiceActivitySchema);
