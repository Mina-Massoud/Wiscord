import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

export const FRIEND_REQUEST_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'] as const;
export type FriendRequestStatus = (typeof FRIEND_REQUEST_STATUSES)[number];

const friendRequestSchema = new Schema(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: FRIEND_REQUEST_STATUSES,
      required: true,
      default: 'pending',
    },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'friend_requests' },
);

// Partial unique index — only one pending row may exist for a given
// (from, to) ordered pair. Declined/cancelled rows are preserved as history
// and don't block a future re-request.
friendRequestSchema.index(
  { fromUserId: 1, toUserId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

// Inbox/outbox queries: recipient or sender + status.
friendRequestSchema.index({ toUserId: 1, status: 1, createdAt: -1 });
friendRequestSchema.index({ fromUserId: 1, status: 1, createdAt: -1 });

applySerialize(friendRequestSchema);

export type FriendRequestRow = InferSchemaType<typeof friendRequestSchema>;
export type FriendRequestDoc = HydratedDocument<FriendRequestRow>;
export const FriendRequest = model('FriendRequest', friendRequestSchema);
