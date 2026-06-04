import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

export const CHANNEL_TYPES = ['text', 'voice'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

const channelSchema = new Schema(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', required: true },
    name: { type: String, required: true, trim: true, maxlength: 64 },
    type: { type: String, enum: CHANNEL_TYPES, required: true },
    position: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'channels' },
);

channelSchema.index({ serverId: 1, position: 1 });
channelSchema.index({ serverId: 1, name: 1 }, { unique: true });

applySerialize(channelSchema);

export type ChannelRow = InferSchemaType<typeof channelSchema>;
export type ChannelDoc = HydratedDocument<ChannelRow>;
export const Channel = model('Channel', channelSchema);
