import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

const channelMemberSchema = new Schema(
  {
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'channel_members' },
);

channelMemberSchema.index({ channelId: 1, userId: 1 }, { unique: true });
channelMemberSchema.index({ userId: 1 });

applySerialize(channelMemberSchema);

export type ChannelMemberRow = InferSchemaType<typeof channelMemberSchema>;
export type ChannelMemberDoc = HydratedDocument<ChannelMemberRow>;
export const ChannelMember = model('ChannelMember', channelMemberSchema);