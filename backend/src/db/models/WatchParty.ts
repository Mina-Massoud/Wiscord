import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * One active Watch Together session per channel. The host picks a video
 * source (YouTube id or a direct media URL) and the server stamps the
 * playback head every time the host hits play/pause/seek. Viewers project
 * their own clock against `currentTimeMs + (now - lastTickAt)` to stay in
 * sync; the Socket.IO gateway pushes the full doc on every change.
 *
 * "Idle" is the just-loaded state before the host has hit play for the
 * first time — useful so viewers can see the source picked without forcing
 * autoplay (which mobile Safari rejects anyway).
 */
export const WATCH_SOURCE_KINDS = ['youtube', 'direct', 'screen'] as const;
export type WatchSourceKind = (typeof WATCH_SOURCE_KINDS)[number];

export const WATCH_PARTY_STATES = ['idle', 'playing', 'paused'] as const;
export type WatchPartyState = (typeof WATCH_PARTY_STATES)[number];

const watchPartySchema = new Schema(
  {
    channelId: { type: String, required: true, unique: true },
    hostUserId: { type: String, required: true },
    sourceKind: { type: String, enum: WATCH_SOURCE_KINDS, required: true },
    sourceUrl: { type: String, required: true },
    sourceTitle: { type: String, default: null },
    state: { type: String, enum: WATCH_PARTY_STATES, required: true, default: 'idle' },
    currentTimeMs: { type: Number, required: true, default: 0 },
    lastTickAt: { type: Date, required: true, default: () => new Date() },
    startedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true, collection: 'watch_parties' },
);

applySerialize(watchPartySchema);

export type WatchPartyRow = InferSchemaType<typeof watchPartySchema>;
export type WatchPartyDoc = HydratedDocument<WatchPartyRow>;
export const WatchParty = model('WatchParty', watchPartySchema);
