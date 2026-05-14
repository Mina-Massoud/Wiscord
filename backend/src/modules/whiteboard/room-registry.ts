import { TLSocketRoom } from '@tldraw/sync-core';

import { logger } from '../../lib/logger.js';
import {
  loadWhiteboardSnapshot,
  persistWhiteboardSnapshot,
} from './snapshot-store.js';

/**
 * Per-process registry of live whiteboard rooms.
 *
 * Each channel has at most one `TLSocketRoom` in memory. The room is
 * created lazily on the first WebSocket connection (after hydrating the
 * latest snapshot from Mongo) and torn down when the last session leaves.
 *
 * Snapshot persistence runs on two timers stacked together:
 *   - Debounce: every edit resets a 2s timer; the timer firing flushes.
 *   - Heartbeat: while a room is hot, force-flush every 15s so a user
 *     who never stops drawing still gets durable saves.
 * Both are belt-and-braces. The room also flushes once more when the
 * last socket leaves, then closes.
 */

interface RoomState {
  channelId: string;
  room: TLSocketRoom;
  flushTimer: NodeJS.Timeout | null;
  heartbeatTimer: NodeJS.Timeout | null;
  dirty: boolean;
  lastEditorId: string;
}

const DEBOUNCE_MS = 2000;
const HEARTBEAT_MS = 15000;

const rooms = new Map<string, RoomState>();
const pending = new Map<string, Promise<RoomState>>();

async function buildRoom(channelId: string): Promise<RoomState> {
  const initialSnapshot = await loadWhiteboardSnapshot(channelId);

  const state: RoomState = {
    channelId,
    room: null as unknown as TLSocketRoom,
    flushTimer: null,
    heartbeatTimer: null,
    dirty: false,
    lastEditorId: '',
  };

  state.room = new TLSocketRoom({
    ...(initialSnapshot ? { initialSnapshot } : {}),
    onDataChange: () => {
      state.dirty = true;
      if (state.flushTimer) clearTimeout(state.flushTimer);
      state.flushTimer = setTimeout(() => {
        void flushRoom(state, 'debounce');
      }, DEBOUNCE_MS);
    },
    onSessionRemoved: (_room: TLSocketRoom, info: { numSessionsRemaining: number }) => {
      if (info.numSessionsRemaining === 0) {
        void closeRoom(channelId, 'last-leave');
      }
    },
    log: {
      warn: (...args: unknown[]) => logger.warn({ channelId, args }, 'tldraw: warn'),
      error: (...args: unknown[]) => logger.error({ channelId, args }, 'tldraw: error'),
    },
  });

  state.heartbeatTimer = setInterval(() => {
    if (state.dirty) void flushRoom(state, 'heartbeat');
  }, HEARTBEAT_MS);

  return state;
}

async function flushRoom(
  state: RoomState,
  reason: 'debounce' | 'heartbeat' | 'last-leave' | 'shutdown',
): Promise<void> {
  if (!state.dirty) return;
  state.dirty = false;
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }
  try {
    const snapshot = state.room.getCurrentSnapshot();
    await persistWhiteboardSnapshot({
      channelId: state.channelId,
      snapshot,
      lastEditorId: state.lastEditorId || 'unknown',
    });
    logger.debug({ channelId: state.channelId, reason }, 'whiteboard: flushed snapshot');
  } catch (err) {
    // Re-mark dirty so the next timer retries; don't lose user work to a
    // transient mongo blip.
    state.dirty = true;
    logger.error({ err, channelId: state.channelId, reason }, 'whiteboard: snapshot flush failed');
  }
}

async function closeRoom(
  channelId: string,
  reason: 'last-leave' | 'shutdown' | 'drop',
): Promise<void> {
  const state = rooms.get(channelId);
  if (!state) return;
  rooms.delete(channelId);
  if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
  if (state.flushTimer) clearTimeout(state.flushTimer);
  // For `drop` (explicit clear) we skip the flush — the caller will wipe
  // the persisted row separately. For the others, flush whatever's dirty.
  if (reason !== 'drop') {
    await flushRoom(state, reason === 'shutdown' ? 'shutdown' : 'last-leave');
  }
  state.room.close();
  logger.info({ channelId, reason }, 'whiteboard: room closed');
}

export async function getOrCreateRoom(channelId: string): Promise<TLSocketRoom> {
  const existing = rooms.get(channelId);
  if (existing) return existing.room;

  const inflight = pending.get(channelId);
  if (inflight) return (await inflight).room;

  const creation = buildRoom(channelId);
  pending.set(channelId, creation);
  try {
    const state = await creation;
    rooms.set(channelId, state);
    return state.room;
  } finally {
    pending.delete(channelId);
  }
}

/**
 * Record which user just produced a change in the room. v1 uses the most
 * recent connector as a proxy for "last editor" — good enough for the
 * audit field, refined later when we wire `onAfterReceiveMessage` to map
 * sessionId → userId precisely.
 */
export function markRoomEditor(channelId: string, userId: string): void {
  const state = rooms.get(channelId);
  if (state) state.lastEditorId = userId;
}

export async function flushAllRooms(): Promise<void> {
  await Promise.all(Array.from(rooms.values()).map((s) => flushRoom(s, 'shutdown')));
}

export async function shutdownRoomRegistry(): Promise<void> {
  const channelIds = Array.from(rooms.keys());
  await Promise.all(channelIds.map((id) => closeRoom(id, 'shutdown')));
}

/**
 * Forcibly drop a room from memory without persisting. Used by the
 * "clear board" HTTP endpoint, which deletes the Mongo row immediately
 * after — flushing here would race that delete and resurrect the row.
 */
export async function dropRoom(channelId: string): Promise<void> {
  await closeRoom(channelId, 'drop');
}

export function getActiveRoomChannelIds(): string[] {
  return Array.from(rooms.keys());
}
