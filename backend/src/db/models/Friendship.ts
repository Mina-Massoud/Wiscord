import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * Canonical, undirected friendship edge.
 *
 * The edge between users A and B is stored as a single row with
 * `userAId < userBId` (lexicographic on the ObjectId hex string). The
 * uniqueness constraint then guarantees one row per pair regardless of who
 * sent the request — accept idempotency falls out of this for free.
 *
 * Reads use `$or: [{ userAId: me }, { userBId: me }]` to find friendships
 * involving the caller; both columns are indexed.
 */
const friendshipSchema = new Schema(
  {
    userAId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userBId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'friendships' },
);

friendshipSchema.index({ userAId: 1, userBId: 1 }, { unique: true });
friendshipSchema.index({ userBId: 1 });

applySerialize(friendshipSchema);

export type FriendshipRow = InferSchemaType<typeof friendshipSchema>;
export type FriendshipDoc = HydratedDocument<FriendshipRow>;
export const Friendship = model('Friendship', friendshipSchema);

/**
 * Canonicalize a pair of user ids so the lower-sorted id is always `a`.
 * Pure — does not touch the database. Both ids must be valid 24-char hex.
 */
export function canonicalPair(
  userIdX: string,
  userIdY: string,
): { a: string; b: string } {
  return userIdX < userIdY
    ? { a: userIdX, b: userIdY }
    : { a: userIdY, b: userIdX };
}
