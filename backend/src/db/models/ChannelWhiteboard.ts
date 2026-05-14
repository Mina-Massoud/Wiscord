import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * One whiteboard document per channel. `snapshot` is the JSON-serialized
 * RoomSnapshot from @tldraw/sync-core — there's no history yet, just the
 * latest committed state. Clients hydrate from this row on cold start,
 * then keep the in-memory TLSocketRoom in sync via WebSocket.
 *
 * Stored as String (not Buffer) because snapshots are JSON and stay
 * grep-able in the mongo shell; typical board sits well under 1 MB.
 * Switch to Buffer if we ever change the wire format to something binary.
 */
const channelWhiteboardSchema = new Schema(
  {
    channelId: {
      type: String,
      required: true,
      unique: true,
    },
    snapshot: { type: String, required: true },
    lastEditorId: { type: String, required: true },
  },
  { timestamps: true, collection: 'channel_whiteboards' },
);

// `unique: true` on channelId implies an index — no extra `.index()` call.

applySerialize(channelWhiteboardSchema);

export type ChannelWhiteboardRow = InferSchemaType<typeof channelWhiteboardSchema>;
export type ChannelWhiteboardDoc = HydratedDocument<ChannelWhiteboardRow>;
export const ChannelWhiteboard = model('ChannelWhiteboard', channelWhiteboardSchema);
