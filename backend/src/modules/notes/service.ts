import { ChannelNotes, type ChannelNotesDoc } from '../../db/models/index.js';
import { clearNotesDoc } from '../realtime/notes-persistence.js';

/**
 * HTTP-facing service layer for collaborative notes. The realtime path
 * (Hocuspocus + Y.Doc) is the source of truth while a doc is open; these
 * functions cover read-after-restart and destructive-but-not-realtime
 * operations.
 *
 * Mirrors the whiteboard service shape so the labs index page can lean
 * on the same patterns and a future channels-team handoff swaps one
 * paginated query for the other without touching component code.
 */

export interface NotesSummary {
  channelId: string;
  updatedAt: string;
  createdAt: string;
  /** Last user to commit a snapshot — `null` for docs hydrated only. */
  updatedBy: string | null;
}

/**
 * Notes docs the user was the most recent editor on. Drives the labs
 * index page at `/app/labs/notes`. Once the channels module ships and
 * notes are scoped to channels the user joined, swap this for a
 * membership-aware query.
 */
export async function listNotesForEditor(params: {
  userId: string;
}): Promise<NotesSummary[]> {
  const rows: ChannelNotesDoc[] = await ChannelNotes.find({
    updatedBy: params.userId,
  })
    .sort({ updatedAt: -1 })
    .limit(100);

  return rows.map((row) => ({
    channelId: row.channelId,
    updatedAt: row.updatedAt?.toISOString() ?? new Date(0).toISOString(),
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedBy: row.updatedBy ?? null,
  }));
}

export async function clearNotes(args: {
  channelId: string;
  userId: string;
}): Promise<{ cleared: true }> {
  // No in-memory room registry to drop here — Hocuspocus owns its own
  // document cache and the next connect re-loads from Mongo. Wiping the
  // row is therefore safe to do directly; connected clients will simply
  // observe a fresh empty doc on their next sync.
  await clearNotesDoc(args.channelId);
  // `userId` reserved for audit logging once we add an audit collection.
  void args.userId;
  return { cleared: true };
}
