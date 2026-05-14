import {
  clearWhiteboardSnapshot,
  loadWhiteboardSnapshot,
} from './snapshot-store.js';
import { dropRoom } from './room-registry.js';
import { ChannelWhiteboard } from '../../db/models/index.js';

/**
 * HTTP-facing service layer for the whiteboard. The realtime path
 * (TLSocketRoom + room-registry) is the source of truth while a board
 * is open; these functions cover the read-after-restart and the
 * destructive-but-not-realtime operations.
 */

export interface WhiteboardSnapshotResponse {
  /** Latest committed RoomSnapshot encoded as base64, or null when empty. */
  snapshot: string | null;
  updatedAt: string | null;
  lastEditorId: string | null;
}

export async function getWhiteboardSnapshot(
  channelId: string,
): Promise<WhiteboardSnapshotResponse> {
  const row = await ChannelWhiteboard.findOne({ channelId });
  if (!row) {
    return { snapshot: null, updatedAt: null, lastEditorId: null };
  }
  // We re-encode the stored JSON as base64 so the response envelope stays
  // JSON-safe and frontends don't have to worry about UTF-8 escaping on
  // raw RoomSnapshot strings (they contain quotes everywhere).
  const snapshotBase64 = Buffer.from(row.snapshot, 'utf8').toString('base64');
  return {
    snapshot: snapshotBase64,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    lastEditorId: row.lastEditorId,
  };
}

export async function clearWhiteboard(args: {
  channelId: string;
  userId: string;
}): Promise<{ cleared: true }> {
  // Drop the in-memory room *before* deleting the DB row. If we deleted
  // first, the room's next flush would resurrect the row with the latest
  // in-memory state and undo the clear.
  await dropRoom(args.channelId);
  await clearWhiteboardSnapshot(args.channelId);
  // `userId` is captured here so the route can log who cleared what when
  // we wire audit logging. Currently unused — the parameter exists to
  // keep the signature stable as we add an audit collection.
  void args.userId;
  // Touch the loader so a later GET returns the post-clear empty state
  // (defensive — `clearWhiteboardSnapshot` already deletes the row).
  void (await loadWhiteboardSnapshot(args.channelId));
  return { cleared: true };
}
