import { Schema, model, type HydratedDocument } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * A named, frozen copy of a channel's whiteboard at a moment in time. The
 * "current" canvas lives in `ChannelWhiteboard` and auto-syncs for collab.
 * Saving the current state creates a row here that doesn't change again —
 * users browse the history list to reload any past snapshot.
 *
 * `snapshot` is the same JSON-serialized tldraw `RoomSnapshot` shape that
 * `ChannelWhiteboard.snapshot` uses, so loading a row back is a 1-to-1
 * swap into the live room.
 */
export interface ChannelWhiteboardSnapshotShape {
  channelId: string;
  title: string;
  snapshot: string;
  savedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const channelWhiteboardSnapshotSchema = new Schema(
  {
    channelId: { type: String, required: true, index: true },
    title: { type: String, required: true, minlength: 1, maxlength: 120 },
    snapshot: { type: String, required: true },
    savedBy: { type: String, required: true },
  },
  { timestamps: true, collection: 'channel_whiteboard_snapshots' },
);

channelWhiteboardSnapshotSchema.index({ channelId: 1, createdAt: -1 });

applySerialize(channelWhiteboardSnapshotSchema);

export type ChannelWhiteboardSnapshotDoc = HydratedDocument<ChannelWhiteboardSnapshotShape>;
export const ChannelWhiteboardSnapshot = model<ChannelWhiteboardSnapshotShape>(
  'ChannelWhiteboardSnapshot',
  channelWhiteboardSnapshotSchema,
);
