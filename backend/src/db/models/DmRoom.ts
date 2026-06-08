import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

const dmRoomSchema = new Schema(
  {
    userAId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userBId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Tracks when each participant last read the DM room to calculate unread counts
    userALastReadAt: { type: Date, default: () => new Date() },
    userBLastReadAt: { type: Date, default: () => new Date() },
    
    // Caching fields to support the sidebar previews without expensive aggregate queries
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: null },
    lastMessageAuthorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'dm_rooms' }
);

// Enforce unique pairs lexicographically to prevent duplicate rooms between two users
dmRoomSchema.index({ userAId: 1, userBId: 1 }, { unique: true });
dmRoomSchema.index({ userBId: 1 });
dmRoomSchema.index({ lastMessageAt: -1 });

applySerialize(dmRoomSchema);

export type DmRoomRow = InferSchemaType<typeof dmRoomSchema>;
export type DmRoomDoc = HydratedDocument<DmRoomRow>;
export const DmRoom = model('DmRoom', dmRoomSchema);

export function canonicalPair(userIdX: string, userIdY: string): { a: string; b: string } {
  return userIdX < userIdY ? { a: userIdX, b: userIdY } : { a: userIdY, b: userIdX };
}
