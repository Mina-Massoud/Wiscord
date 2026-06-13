import { EventEmitter } from 'node:events';

import { logger } from '../../lib/logger.js';

/**
 * v1 presence is connection-derived: a user is `online` the moment they have
 * at least one live socket, `offline` once their last tab disconnects. `idle`
 * is an optional, client-driven refinement (a heartbeat flips it) layered on
 * top of `online`. The channel-scoped study states (Focusing / On break) are a
 * separate concern owned by `voice-activity` — this store is global per-user.
 */
export type PresenceStatus = 'online' | 'idle' | 'offline';

export interface PresenceChange {
  userId: string;
  status: PresenceStatus;
}

interface Entry {
  /** Never 'offline' — an offline user has no entry. */
  status: 'online' | 'idle';
  /** Live socket count across the user's tabs. */
  socketCount: number;
  lastActiveAt: number;
}

export declare interface PresenceStore {
  on(event: 'state_changed', listener: (change: PresenceChange) => void): this;
  off(event: 'state_changed', listener: (change: PresenceChange) => void): this;
  emit(event: 'state_changed', change: PresenceChange): boolean;
}

/**
 * In-memory per-user presence. Source of truth for "is user X online right
 * now". Fed by the Socket.IO gateway's connect/disconnect lifecycle; drained
 * by the gateway, which fans each change out to the changed user's friends.
 *
 * One process owns this store — multi-instance deployments will need a Redis
 * adapter (same caveat as the voice presence store).
 */
export class PresenceStore extends EventEmitter {
  private readonly byUser = new Map<string, Entry>();

  /** Register a newly-connected socket. Emits `online` on the first one. */
  markOnline(userId: string): void {
    const prev = this.byUser.get(userId);
    if (prev) {
      prev.socketCount += 1;
      prev.lastActiveAt = Date.now();
      return;
    }
    this.byUser.set(userId, { status: 'online', socketCount: 1, lastActiveAt: Date.now() });
    this.emit('state_changed', { userId, status: 'online' });
    logger.debug({ userId }, 'presence: online');
  }

  /** Deregister a disconnected socket. Emits `offline` when the last one goes. */
  markOffline(userId: string): void {
    const prev = this.byUser.get(userId);
    if (!prev) return;
    prev.socketCount -= 1;
    if (prev.socketCount > 0) {
      prev.lastActiveAt = Date.now();
      return;
    }
    this.byUser.delete(userId);
    this.emit('state_changed', { userId, status: 'offline' });
    logger.debug({ userId }, 'presence: offline');
  }

  /** Flip the idle refinement. No-op when the user is offline or unchanged. */
  setIdle(userId: string, idle: boolean): void {
    const entry = this.byUser.get(userId);
    if (!entry) return;
    const next: Entry['status'] = idle ? 'idle' : 'online';
    if (entry.status === next) return;
    entry.status = next;
    entry.lastActiveAt = Date.now();
    this.emit('state_changed', { userId, status: next });
  }

  get(userId: string): PresenceStatus {
    return this.byUser.get(userId)?.status ?? 'offline';
  }

  snapshot(userIds: string[]): Record<string, PresenceStatus> {
    const out: Record<string, PresenceStatus> = {};
    for (const id of userIds) out[id] = this.get(id);
    return out;
  }
}

export const presence: PresenceStore = new PresenceStore();
