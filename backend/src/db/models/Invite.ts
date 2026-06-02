import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

const inviteSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, default: null },
    maxUses: { type: Number, default: null },
    useCount: { type: Number, required: true, default: 0 },
    isDefault: { type: Boolean, required: true, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'invites' },
);

inviteSchema.index({ serverId: 1 });
inviteSchema.index({ serverId: 1, isDefault: 1 });

applySerialize(inviteSchema);

export type InviteRow = InferSchemaType<typeof inviteSchema>;
export type InviteDoc = HydratedDocument<InviteRow>;
export const Invite = model('Invite', inviteSchema);
