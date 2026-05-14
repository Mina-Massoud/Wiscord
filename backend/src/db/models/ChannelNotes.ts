import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * One collaborative notes doc per channel. `ydoc` is the binary state vector
 * produced by `Y.encodeStateAsUpdate(doc)` — the entire history compacted into
 * a single update so we can rehydrate the room on cold start. Hocuspocus
 * applies it back into a fresh `Y.Doc` on `onLoadDocument`.
 *
 * Stored as Buffer (not JSON) because Yjs updates are a binary CRDT format
 * and stringifying them would balloon storage and break round-trip. Typical
 * doc sits under 50 KB; the cap is the 16 MB Mongo BSON limit, miles away.
 *
 * `updatedBy` is the most recent author at flush time — a "last edited by"
 * audit field, not a full editor history. The frontend layers richer
 * presence on top via Yjs awareness (transient, in-memory only).
 */
const channelNotesSchema = new Schema(
  {
    channelId: {
      type: String,
      required: true,
      unique: true,
    },
    ydoc: { type: Buffer, required: true },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, collection: 'channel_notes' },
);

// `unique: true` on channelId implies an index — no extra `.index()` call.

applySerialize(channelNotesSchema);

export type ChannelNotesRow = InferSchemaType<typeof channelNotesSchema>;
export type ChannelNotesDoc = HydratedDocument<ChannelNotesRow>;
export const ChannelNotes = model('ChannelNotes', channelNotesSchema);
