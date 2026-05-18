import {
  ChannelWhiteboard,
  ChannelWhiteboardSnapshot,
} from '../../db/models/index.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { dropRoom } from './room-registry.js';
import { loadWhiteboardSnapshot } from './snapshot-store.js';
import { generateSnapshotTitle } from './snapshot-title.js';

/**
 * Save the current scratch state as a named historical snapshot. The
 * scratch row in `ChannelWhiteboard` is unchanged — collaborators keep
 * editing the live canvas; this just freezes a copy into the history list.
 *
 * Empty scratch (no Mongo row, no committed strokes) is rejected with
 * `nothing_to_save` so a user can't accumulate identical blank snapshots
 * by spam-clicking the save button.
 */
export interface WhiteboardSnapshotSummary {
  id: string;
  title: string;
  savedBy: string;
  createdAt: string;
}

export async function saveWhiteboardSnapshot(args: {
  channelId: string;
  userId: string;
  title?: string;
}): Promise<WhiteboardSnapshotSummary> {
  const scratch = await ChannelWhiteboard.findOne({ channelId: args.channelId });
  if (!scratch) {
    throw badRequest('nothing_to_save', 'There is nothing on the canvas yet — draw something first.');
  }

  const title = args.title?.trim() || generateSnapshotTitle(args.channelId);
  const created = await ChannelWhiteboardSnapshot.create({
    channelId: args.channelId,
    title,
    snapshot: scratch.snapshot,
    savedBy: args.userId,
  });

  return {
    id: created.id as string,
    title: created.title,
    savedBy: created.savedBy,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function listWhiteboardSnapshots(
  channelId: string,
): Promise<WhiteboardSnapshotSummary[]> {
  const rows = await ChannelWhiteboardSnapshot.find({ channelId })
    .sort({ createdAt: -1 })
    .limit(200);
  return rows.map((row): WhiteboardSnapshotSummary => ({
    id: row.id as string,
    title: row.title,
    savedBy: row.savedBy,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Load a saved snapshot back into the live scratch state. Strategy:
 *   1. Find the snapshot row and copy its serialized state into
 *      `ChannelWhiteboard` (upsert) — this is the persisted view that
 *      cold-starting clients will hydrate from.
 *   2. Drop the in-memory `TLSocketRoom`. Connected clients reconnect via
 *      tldraw's auto-reconnect, hydrate from the new persisted state, and
 *      see the snapshot as the current canvas.
 *
 * The "drop the room" step is the same primitive `clearWhiteboard` uses —
 * it forces every connected client to rebuild their store from scratch
 * (the only way to replace tldraw's in-memory state without touching the
 * client code).
 */
export async function loadWhiteboardSnapshotIntoScratch(args: {
  channelId: string;
  snapshotId: string;
  userId: string;
}): Promise<{ loaded: true }> {
  const snapshot = await ChannelWhiteboardSnapshot.findOne({
    _id: args.snapshotId,
    channelId: args.channelId,
  });
  if (!snapshot) throw notFound('whiteboard_snapshot');

  // Drop the in-memory room *before* replacing the DB row. If we wrote
  // first, the live room's next debounced flush would race our write and
  // overwrite the snapshot with whatever was on the canvas at that moment.
  await dropRoom(args.channelId);

  await ChannelWhiteboard.findOneAndUpdate(
    { channelId: args.channelId },
    { $set: { snapshot: snapshot.snapshot, lastEditorId: args.userId } },
    { upsert: true, new: true },
  );

  // Defensive read so the next /snapshot GET returns the freshly-loaded
  // state without any in-memory staleness (loader is a plain Mongo read).
  void (await loadWhiteboardSnapshot(args.channelId));
  return { loaded: true } as const;
}

export async function deleteWhiteboardSnapshot(args: {
  channelId: string;
  snapshotId: string;
}): Promise<{ deleted: true }> {
  const result = await ChannelWhiteboardSnapshot.deleteOne({
    _id: args.snapshotId,
    channelId: args.channelId,
  });
  if (result.deletedCount === 0) throw notFound('whiteboard_snapshot');
  return { deleted: true } as const;
}
