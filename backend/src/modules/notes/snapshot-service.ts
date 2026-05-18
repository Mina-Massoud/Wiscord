import {
  ChannelNotes,
  ChannelNotesSnapshot,
} from '../../db/models/index.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { closeNotesDocument } from '../realtime/notes-gateway.js';
import { generateSnapshotTitle } from '../whiteboard/snapshot-title.js';

export interface NotesSnapshotSummary {
  id: string;
  title: string;
  savedBy: string;
  createdAt: string;
}

/**
 * Save the current scratch Yjs doc as a frozen history snapshot. Empty
 * docs (no row yet) are rejected with `nothing_to_save` so the user
 * can't accumulate identical blank entries.
 */
export async function saveNotesSnapshot(args: {
  channelId: string;
  userId: string;
  title?: string;
}): Promise<NotesSnapshotSummary> {
  const scratch = await ChannelNotes.findOne({ channelId: args.channelId });
  if (!scratch?.ydoc) {
    throw badRequest('nothing_to_save', 'There is nothing in the notes yet — write something first.');
  }

  const title = args.title?.trim() || generateSnapshotTitle(args.channelId);
  const created = await ChannelNotesSnapshot.create({
    channelId: args.channelId,
    title,
    ydoc: scratch.ydoc,
    savedBy: args.userId,
  });

  return {
    id: created.id as string,
    title: created.title,
    savedBy: created.savedBy,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function listNotesSnapshots(channelId: string): Promise<NotesSnapshotSummary[]> {
  const rows = await ChannelNotesSnapshot.find({ channelId })
    .sort({ createdAt: -1 })
    .limit(200);
  return rows.map((row): NotesSnapshotSummary => ({
    id: row.id as string,
    title: row.title,
    savedBy: row.savedBy,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Load a saved snapshot back into the scratch. Strategy:
 *   1. Close the live Hocuspocus document — every connected client is
 *      kicked, which forces Yjs reconnect + `onLoadDocument` re-hydration
 *      from Mongo.
 *   2. Overwrite the persisted `ChannelNotes.ydoc` with the snapshot's
 *      bytes so the re-hydration applies the historical state.
 *
 * Closing before writing avoids a race where Hocuspocus's pending
 * debounced flush could overwrite our write seconds later.
 */
export async function loadNotesSnapshotIntoScratch(args: {
  channelId: string;
  snapshotId: string;
  userId: string;
}): Promise<{ loaded: true }> {
  const snapshot = await ChannelNotesSnapshot.findOne({
    _id: args.snapshotId,
    channelId: args.channelId,
  });
  if (!snapshot) throw notFound('notes_snapshot');

  await closeNotesDocument(args.channelId);

  await ChannelNotes.findOneAndUpdate(
    { channelId: args.channelId },
    { $set: { ydoc: snapshot.ydoc, updatedBy: args.userId } },
    { upsert: true, new: true },
  );

  return { loaded: true } as const;
}

export async function deleteNotesSnapshot(args: {
  channelId: string;
  snapshotId: string;
}): Promise<{ deleted: true }> {
  const result = await ChannelNotesSnapshot.deleteOne({
    _id: args.snapshotId,
    channelId: args.channelId,
  });
  if (result.deletedCount === 0) throw notFound('notes_snapshot');
  return { deleted: true } as const;
}
