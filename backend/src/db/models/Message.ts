import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

const reactionSchema = new Schema(
  {
    emoji: { type: String, required: true },
    userIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    channelId: { type: String, required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, minlength: 1, maxlength: 4000 },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    mentions: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    reactions: { type: [reactionSchema], default: [] },
  },
  { timestamps: true, collection: 'messages' }
);

// Indexes
messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ channelId: 1, mentions: 1 });

applySerialize(messageSchema);

export type MessageRow = InferSchemaType<typeof messageSchema>;
export type MessageDoc = HydratedDocument<MessageRow>;
export const Message = model('Message', messageSchema);
