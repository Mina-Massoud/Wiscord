import * as Y from 'yjs';

import { ChannelNotes } from '../../db/models/index.js';
import { logger } from '../../lib/logger.js';

/**
 * Mongo I/O for collaborative notes Yjs documents.
 *
 * Storage shape: a single Buffer per channel produced by
 * `Y.encodeStateAsUpdate(doc)`. This is the entire CRDT state compacted
 * into one update — applying it back into a fresh `Y.Doc` rebuilds the
 * full document including merge history needed for further offline edits.
 *
 * No JSON, no markdown mirror in v1. The frontend serializes to markdown
 * on demand (export / AI ask) by walking the Y.XmlFragment through
 * tiptap-markdown. Adding a backend plaintext column would require running
 * a ProseMirror schema serializer in Node, which is heavyweight for a
 * field nothing currently reads.
 */

const DOC_FIELD = 'default';

export function getNotesDocName(channelId: string): string {
  return `channel:${channelId}:notes`;
}

export function parseChannelIdFromDocName(documentName: string): string | null {
  const match = /^channel:([0-9a-f-]{36}):notes$/i.exec(documentName);
  return match ? (match[1] ?? null) : null;
}

export async function loadNotesUpdate(channelId: string): Promise<Uint8Array | null> {
  const row = await ChannelNotes.findOne({ channelId });
  if (!row?.ydoc) return null;
  // Mongoose returns Buffer; Yjs wants Uint8Array. Same underlying bytes,
  // different view — copy the slice so we own the memory.
  return new Uint8Array(row.ydoc.buffer, row.ydoc.byteOffset, row.ydoc.byteLength);
}

export async function persistNotesDoc(args: {
  channelId: string;
  doc: Y.Doc;
  updatedBy: string | null;
}): Promise<void> {
  const update = Y.encodeStateAsUpdate(args.doc);
  await ChannelNotes.findOneAndUpdate(
    { channelId: args.channelId },
    {
      $set: {
        ydoc: Buffer.from(update),
        updatedBy: args.updatedBy,
      },
    },
    { upsert: true, new: true },
  );
}

export async function clearNotesDoc(channelId: string): Promise<void> {
  await ChannelNotes.deleteOne({ channelId });
}

/**
 * Hydrate a Hocuspocus-managed `Y.Doc` with the persisted update if one
 * exists. Used inside `onLoadDocument`.
 *
 * Returns `true` if a row was found and applied, `false` if the doc is
 * fresh — the caller can decide whether to leave the doc empty or seed
 * a placeholder block.
 */
export async function hydrateNotesDoc(channelId: string, target: Y.Doc): Promise<boolean> {
  try {
    const update = await loadNotesUpdate(channelId);
    if (!update) return false;
    Y.applyUpdate(target, update, 'load');
    return true;
  } catch (err) {
    // Corrupt payload — start the room fresh instead of refusing to open.
    // The next store overwrites the bad row.
    logger.warn({ err, channelId }, 'notes: corrupt ydoc, starting empty');
    return false;
  }
}

// Re-exported so callers don't import yjs directly for the field name.
export { DOC_FIELD as NOTES_DOC_FIELD };
