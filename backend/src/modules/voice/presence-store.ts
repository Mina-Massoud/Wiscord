import { EventEmitter } from 'node:events';

import { logger } from '../../lib/logger.js';
import type { ActivityKind } from '../../db/models/VoiceActivity.js';

export interface VoiceParticipant {
  identity: string;
  name: string;
  joinedAt: number;
  /**
   * What this participant is currently doing in the channel:
   *  - `null` → on the voice grid (or nothing active)
   *  - a kind → they've opted into that activity locally; other participants
   *    can see them in the "in progress" overlay and choose to join.
   *
   * Per-user state, not channel-wide — Mina being in Notes never forces Sam
   * into Notes. See `setActivity` for the update path.
   */
  activityKind: ActivityKind | null;
}

export interface VoiceStateChange {
  channelId: string;
  participants: VoiceParticipant[];
}

/**
 * In-memory voice presence store. Source of truth for "who is currently in
 * channel X" and "what activity (if any) is each one in" — fed by
 * `voice/livekit-presence-poller`, the LiveKit webhook receiver, and the
 * `POST /channels/:id/activity/presence` route. Drained by the Socket.IO
 * gateway, which fans full snapshots out to every voice-aware client.
 *
 * Keyed by `channelId` (UUID, no `channel-` prefix). One process owns this
 * store; multi-instance deployments will need a Redis adapter (TODO when we
 * horizontally scale).
 *
 * `activityKind` is preserved across LiveKit refresh `replace()` calls so a
 * poller tick doesn't wipe a participant's "I'm in Notes" state every two
 * seconds. The LiveKit feed doesn't know about our activity slot — only the
 * `setActivity` path mutates it.
 */
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
    return Array.from(room.values()).sort((a, b) => a.joinedAt - b.joinedAt);
  }

  snapshot(channelIds: string[]): Record<string, VoiceParticipant[]> {
    const out: Record<string, VoiceParticipant[]> = {};
    for (const id of channelIds) out[id] = this.list(id);
    return out;
  }

  /**
   * Replace the full participant set for `channelId`. Preserves each
   * still-present participant's `activityKind` so a LiveKit refresh doesn't
   * silently wipe "I'm in Notes". Returns true when the set actually changed.
   *
   * The poller passes in participants without `activityKind` (it doesn't
   * know — it's coming from LiveKit, not from us). We default to null for
   * new entries and inherit the previous value for existing entries.
   */
  replace(
    channelId: string,
    participants: ReadonlyArray<Omit<VoiceParticipant, 'activityKind'>>,
  ): boolean {
    const prev = this.byChannel.get(channelId) ?? new Map<string, VoiceParticipant>();
    const next = new Map<string, VoiceParticipant>();
    for (const p of participants) {
      const before = prev.get(p.identity);
      next.set(p.identity, {
        identity: p.identity,
        name: p.name,
        joinedAt: p.joinedAt,
        activityKind: before?.activityKind ?? null,
      });
    }

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

  /**
   * Update a single participant's activity kind. Returns true when the
   * value changed (and emits state_changed). Returns false silently when
   * the user isn't in the channel — that's the right behavior for a flaky
   * client that posts presence right before the LiveKit join lands;
   * they'll re-post once they're seen as present.
   */
  setActivity(channelId: string, identity: string, kind: ActivityKind | null): boolean {
    const room = this.byChannel.get(channelId);
    if (!room) return false;
    const current = room.get(identity);
    if (!current) return false;
    if (current.activityKind === kind) return false;
    room.set(identity, { ...current, activityKind: kind });
    this.emit('state_changed', {
      channelId,
      participants: this.list(channelId),
    } satisfies VoiceStateChange);
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
    return Array.from(this.byChannel.keys());
  }
}

function differs(
  prev: Map<string, VoiceParticipant>,
  next: Map<string, VoiceParticipant>,
): boolean {
  if (prev.size !== next.size) return true;
  for (const [id, p] of Array.from(next.entries())) {
    const before = prev.get(id);
    if (!before) return true;
    if (before.name !== p.name) return true;
    if (before.activityKind !== p.activityKind) return true;
  }
  return false;
}

export const voicePresence: VoicePresenceStore = new VoicePresenceStore();
