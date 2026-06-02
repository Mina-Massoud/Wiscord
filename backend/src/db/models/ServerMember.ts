import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

export const SERVER_MEMBER_ROLES = ['owner', 'member'] as const;
export type ServerMemberRole = (typeof SERVER_MEMBER_ROLES)[number];

const serverMemberSchema = new Schema(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: SERVER_MEMBER_ROLES, required: true, default: 'member' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'server_members' },
);

serverMemberSchema.index({ serverId: 1, userId: 1 }, { unique: true });
serverMemberSchema.index({ userId: 1 });

applySerialize(serverMemberSchema);

export type ServerMemberRow = InferSchemaType<typeof serverMemberSchema>;
export type ServerMemberDoc = HydratedDocument<ServerMemberRow>;
export const ServerMember = model('ServerMember', serverMemberSchema);
