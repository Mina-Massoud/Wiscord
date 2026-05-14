import { EventEmitter } from 'node:events';

import { WatchParty } from '../../db/models/WatchParty.js';
import type { WatchPartyDoc } from '../../db/models/WatchParty.js';
import { forbidden, notFound } from '../../lib/errors.js';
import type { StartPartyBody, ControlBody, WatchPartyResponse } from './schemas.js';

/**
 * Event bus for Watch Party state changes. The realtime gateway listens to
 * `state_changed` and fans the snapshot out to every socket in the channel
 * room — viewers project their clock against the stamped `lastTickAt` to
 * stay synced.
 */
class WatchPartyEvents extends EventEmitter {}
export const watchPartyEvents = new WatchPartyEvents();

export interface WatchPartyChange {
  channelId: string;
  /** null on a stop event — viewers should leave watch mode. */
  snapshot: WatchPartyResponse | null;
}

function toResponse(doc: WatchPartyDoc): WatchPartyResponse {
  return {
    channelId: doc.channelId,
    hostUserId: doc.hostUserId,
    source: {
      kind: doc.sourceKind,
      url: doc.sourceUrl,
      title: doc.sourceTitle ?? null,
    },
    state: doc.state,
    currentTimeMs: doc.currentTimeMs,
    lastTickAt: doc.lastTickAt.toISOString(),
    startedAt: doc.startedAt.toISOString(),
  };
}

function broadcast(doc: WatchPartyDoc): WatchPartyResponse {
  const snapshot = toResponse(doc);
  watchPartyEvents.emit('state_changed', { channelId: doc.channelId, snapshot });
  return snapshot;
}

/**
 * Read the current party for a channel, or null if none is active.
 *
 * TODO(channel-team): membership check once channels exist. v1 trusts any
 * authed caller in the same way voice tokens currently do.
 */
export async function getParty(channelId: string): Promise<WatchPartyResponse | null> {
  const doc = await WatchParty.findOne({ channelId });
  return doc ? toResponse(doc) : null;
}

/**
 * Start a party in `channelId` with `userId` as host. If a party is already
 * active we overwrite it — switching the source mid-watch is a host action,
 * not a separate "stop then start" round-trip.
 *
 * Clock starts at zero (`currentTimeMs: 0`), state idle. The host then sends
 * a `control` with action `play` to begin playback for everyone.
 */
export async function startParty({
  channelId,
  userId,
  source,
}: {
  channelId: string;
  userId: string;
  source: StartPartyBody['source'];
}): Promise<WatchPartyResponse> {
  const now = new Date();
  // Upsert-or-overwrite: switching the source mid-watch is a single host
  // action, not a "stop then start" round-trip. We do the upsert as a
  // two-step (find / save) instead of `findOneAndUpdate` because the latter
  // triggers a deep generic instantiation under Mongoose 9 + strict TS.
  let doc = await WatchParty.findOne({ channelId });
  if (doc) {
    doc.hostUserId = userId;
    doc.sourceKind = source.kind;
    doc.sourceUrl = source.url;
    doc.sourceTitle = source.title ?? null;
    doc.state = 'idle';
    doc.currentTimeMs = 0;
    doc.lastTickAt = now;
    doc.startedAt = now;
    await doc.save();
  } else {
    doc = await WatchParty.create({
      channelId,
      hostUserId: userId,
      sourceKind: source.kind,
      sourceUrl: source.url,
      sourceTitle: source.title ?? null,
      state: 'idle',
      currentTimeMs: 0,
      lastTickAt: now,
      startedAt: now,
    });
  }
  return broadcast(doc);
}

/**
 * Stop the party. Anyone can stop their own host session; non-hosts are
 * rejected. Returns true if a party existed, false if it was already gone
 * (idempotent — calling stop twice doesn't error).
 */
export async function stopParty({
  channelId,
  userId,
}: {
  channelId: string;
  userId: string;
}): Promise<boolean> {
  const doc = await WatchParty.findOne({ channelId });
  if (!doc) return false;
  if (doc.hostUserId !== userId) {
    throw forbidden('Only the host can end the party');
  }
  await WatchParty.deleteOne({ channelId });
  watchPartyEvents.emit('state_changed', {
    channelId,
    snapshot: null,
  });
  return true;
}

/**
 * Internal: end the party for a system-level reason (host disconnected from
 * voice, LiveKit room finished, etc). Skips the host check because the
 * caller is the system, not a user.
 *
 * Idempotent: returns the userId that was hosting (or null if no party),
 * so callers can log a meaningful audit trail.
 */
export async function forceStopParty({
  channelId,
  reason,
}: {
  channelId: string;
  reason: string;
}): Promise<{ stopped: boolean; hostUserId: string | null; reason: string }> {
  const doc = await WatchParty.findOne({ channelId });
  if (!doc) return { stopped: false, hostUserId: null, reason };
  const hostUserId = doc.hostUserId;
  await WatchParty.deleteOne({ channelId });
  watchPartyEvents.emit('state_changed', { channelId, snapshot: null });
  return { stopped: true, hostUserId, reason };
}

/**
 * Look up the current host of a channel's party, or null if none. Used by
 * the voice webhook + poller to decide whether a leaving participant was
 * the host (and thus should auto-end the party).
 */
export async function getHostUserId(channelId: string): Promise<string | null> {
  const doc = await WatchParty.findOne({ channelId }).select('hostUserId').lean();
  return doc?.hostUserId ?? null;
}

/**
 * Apply a host control (play / pause / seek). Stamps `lastTickAt = now()` so
 * viewers know what wall-clock the playhead is anchored to.
 *
 * Non-hosts are silently rejected with `forbidden` — the frontend gates the
 * UI itself but this is the truth boundary. The wire format is intentionally
 * stamped server-side so a clock-drifting client can't push wrong times.
 */
export async function applyControl({
  channelId,
  userId,
  command,
}: {
  channelId: string;
  userId: string;
  command: ControlBody;
}): Promise<WatchPartyResponse> {
  const doc = await WatchParty.findOne({ channelId });
  if (!doc) throw notFound('watch_party');
  if (doc.hostUserId !== userId) {
    throw forbidden('Only the host can control playback');
  }

  const now = new Date();
  doc.currentTimeMs = command.timeMs;
  doc.lastTickAt = now;
  if (command.action === 'play') doc.state = 'playing';
  else if (command.action === 'pause') doc.state = 'paused';
  // 'seek' preserves the current play/pause state — only the playhead moves.
  await doc.save();

  return broadcast(doc);
}

/**
 * Transfer host to another user. Caller must currently be host. The new host
 * must be passed by id — the frontend looks them up via voice presence to
 * surface a list of currently-present users.
 */
export async function transferHost({
  channelId,
  fromUserId,
  toUserId,
}: {
  channelId: string;
  fromUserId: string;
  toUserId: string;
}): Promise<WatchPartyResponse> {
  const doc = await WatchParty.findOne({ channelId });
  if (!doc) throw notFound('watch_party');
  if (doc.hostUserId !== fromUserId) {
    throw forbidden('Only the current host can transfer the host role');
  }
  doc.hostUserId = toUserId;
  await doc.save();
  return broadcast(doc);
}
