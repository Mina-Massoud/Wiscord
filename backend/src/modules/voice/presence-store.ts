import { EventEmitter } from 'node:events';

import { logger } from '../../lib/logger.js';

export interface VoiceParticipant {
  identity: string;
  name: string;
  joinedAt: number;
}

export interface VoiceStateChange {
  channelId: string;
  participants: VoiceParticipant[];
}

/**
 * In-memory voice presence store. Source of truth for "who is currently in
 * channel X" — fed by `voice/livekit-presence-poller` and (later) the LiveKit
 * webhook receiver, drained by the Socket.IO gateway.
 *
 * Keyed by `channelId` (the UUID portion — we strip the `channel-` prefix
 * LiveKit sees so downstream APIs don't have to think about that detail).
 *
 * Emits `state_changed` with the full participant list every time a channel
 * mutates. We emit full snapshots rather than diffs because the snapshot is
 * tiny (a few rows) and lets late-joining sockets converge with a single
 * payload instead of replaying a history of deltas.
 *
 * One process owns this store. Multi-instance deployments need a Redis
 * adapter (TODO when we add horizontal scaling) but a single Node process
 * happily handles thousands of users.
 */
// Declaration merging — gives `.on('state_changed', …)` and `.emit(...)` real
// types instead of EventEmitter's `(event: string | symbol, ...) => any`.
export declare interface VoicePresenceStore {
  on(event: 'state_changed', listener: (change: VoiceStateChange) => void): this;
  off(event: 'state_changed', listener: (change: VoiceStateChange) => void): this;
  emit(event: 'state_changed', change: VoiceStateChange): boolean;
}

export class VoicePresenceStore extends EventEmitter {
  private readonly byChannel = new Map<string, Map<string, VoiceParticipant>>();

  list(channelId: string): VoiceParticipant[] {
    const room = this.byChannel.get(channelId);
    if (!room) return [];
    return [...room.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  snapshot(channelIds: string[]): Record<string, VoiceParticipant[]> {
    const out: Record<string, VoiceParticipant[]> = {};
    for (const id of channelIds) out[id] = this.list(id);
    return out;
  }

  /**
   * Replace the full participant set for `channelId`. Returns true when the
   * set actually changed (different members or different order of joinedAt)
   * so the caller can decide whether to emit.
   */
  replace(channelId: string, participants: VoiceParticipant[]): boolean {
    const prev = this.byChannel.get(channelId) ?? new Map();
    const next = new Map<string, VoiceParticipant>();
    for (const p of participants) next.set(p.identity, p);

    const changed = differs(prev, next);
    if (!changed) return false;

    if (next.size === 0) {
      this.byChannel.delete(channelId);
    } else {
      this.byChannel.set(channelId, next);
    }

    const payload: VoiceStateChange = { channelId, participants: this.list(channelId) };
    logger.debug(
      { channelId, count: payload.participants.length },
      'voice: presence state_changed',
    );
    this.emit('state_changed', payload);
    return true;
  }

  /** Drop a single participant; emits if anything changed. */
  remove(channelId: string, identity: string): boolean {
    const room = this.byChannel.get(channelId);
    if (!room || !room.has(identity)) return false;
    room.delete(identity);

    const next = this.list(channelId);
    if (next.length === 0) this.byChannel.delete(channelId);

    this.emit('state_changed', { channelId, participants: next } satisfies VoiceStateChange);
    return true;
  }

  /** Active channels (the ones that currently have anyone in them). */
  activeChannelIds(): string[] {
    return [...this.byChannel.keys()];
  }
}

function differs(
  prev: Map<string, VoiceParticipant>,
  next: Map<string, VoiceParticipant>,
): boolean {
  if (prev.size !== next.size) return true;
  for (const [id, p] of next) {
    const before = prev.get(id);
    if (!before) return true;
    if (before.name !== p.name) return true;
  }
  return false;
}

export const voicePresence: VoicePresenceStore = new VoicePresenceStore();
