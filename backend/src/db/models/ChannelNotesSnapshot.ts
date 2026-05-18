import { Schema, model, type HydratedDocument } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * A named, frozen copy of a channel's notes Yjs doc. The "current" doc
 * lives in `ChannelNotes` and auto-syncs via Hocuspocus. Saving the
 * current state creates a row here that doesn't change again — users
 * browse the history list to reload any past snapshot.
 *
 * `ydoc` is the same `Y.encodeStateAsUpdate(doc)` Buffer that
 * `ChannelNotes.ydoc` uses, so loading a row back is a 1-to-1 swap of the
 * persisted state. The Hocuspocus document is then closed so connected
 * clients reconnect and re-hydrate from the new state.
 */
export interface ChannelNotesSnapshotShape {
  channelId: string;
  title: string;
  ydoc: Buffer;
  savedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const channelNotesSnapshotSchema = new Schema(
  {
    channelId: { type: String, required: true, index: true },
    title: { type: String, required: true, minlength: 1, maxlength: 120 },
    ydoc: { type: Buffer, required: true },
    savedBy: { type: String, required: true },
  },
  { timestamps: true, collection: 'channel_notes_snapshots' },
);

channelNotesSnapshotSchema.index({ channelId: 1, createdAt: -1 });

applySerialize(channelNotesSnapshotSchema);

export type ChannelNotesSnapshotDoc = HydratedDocument<ChannelNotesSnapshotShape>;
export const ChannelNotesSnapshot = model<ChannelNotesSnapshotShape>(
  'ChannelNotesSnapshot',
  channelNotesSnapshotSchema,
);
