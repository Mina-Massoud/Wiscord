import { EventEmitter } from 'node:events';

import {
  FriendRequest,
  Friendship,
  User,
  canonicalPair,
  type FriendRequestDoc,
  type UserDoc,
} from '../../db/models/index.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import type { FriendDto, FriendRequestDto, FriendUserDto } from './schemas.js';

/**
 * Event bus for the realtime gateway. The gateway forwards every change to the
 * relevant user's `user:<id>` room — see `modules/realtime/gateway.ts`.
 *
 * Why a bus instead of importing the gateway directly: the service stays free
 * of side-channels (it's pure DB + emit), tests can subscribe without booting
 * Socket.IO, and the gateway is the only place that knows about rooms.
 */
class FriendEvents extends EventEmitter {}
export const friendEvents = new FriendEvents();

export interface FriendRequestIncomingEvent {
  toUserId: string;
  request: FriendRequestDto;
}
export interface FriendRequestRespondedEvent {
  /** The user who needs to know about the response (sender for accept/decline,
   * recipient for cancel). */
  toUserId: string;
  requestId: string;
  /** When status is 'accepted', also includes the new friend's profile so
   * the recipient's UI can prepend without an extra fetch. */
  newFriend: FriendDto | null;
}
export interface FriendRemovedEvent {
  toUserId: string;
  removedUserId: string;
}

function toUserDto(user: UserDoc): FriendUserDto {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

function toRequestDto(
  doc: FriendRequestDoc,
  callerId: string,
  otherUser: UserDoc,
): FriendRequestDto {
  return {
    id: doc._id.toString(),
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    respondedAt: doc.respondedAt ? doc.respondedAt.toISOString() : null,
    user: toUserDto(otherUser),
    outgoing: doc.fromUserId.toString() === callerId,
  };
}

// ── Search ────────────────────────────────────────────────────────────────

/**
 * Username prefix search. Excludes the caller and anyone they're already
 * friends with. Capped at 10. Returns only the minimum profile fields needed
 * to render a row — never email, presence, or anything sensitive.
 */
export async function searchUsersByUsername(
  callerId: string,
  q: string,
): Promise<FriendUserDto[]> {
  const friendships = await Friendship.find({
    $or: [{ userAId: callerId }, { userBId: callerId }],
  });
  const friendIdSet = new Set<string>([callerId]);
  for (const f of friendships) {
    const a = f.userAId.toString();
    const b = f.userBId.toString();
    friendIdSet.add(a === callerId ? b : a);
  }

  // Escape regex meta-characters defensively — Zod already restricts q to
  // [a-z0-9_], so this is belt-and-suspenders.
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = await User.find({
    username: { $regex: `^${escaped}`, $options: 'i' },
    _id: { $nin: Array.from(friendIdSet) },
  }).limit(10);

  return matches.map(toUserDto);
}

// ── Send / list requests ──────────────────────────────────────────────────

/**
 * Look up the recipient by username, run the invariants, and persist.
 *
 * Auto-accept race: if there's already a pending request in the *reverse*
 * direction, the only correct behavior is to accept it — otherwise two users
 * simultaneously sending each other a request would land in a deadlock where
 * neither sees the other's pending row. Returns the accepted-request DTO with
 * `status: 'accepted'` in that case so the caller's UI can render the new
 * friendship straight away.
 */
export async function sendFriendRequest(
  callerId: string,
  toUsername: string,
): Promise<FriendRequestDto> {
  const recipient = await User.findOne({ username: toUsername });
  if (!recipient) throw notFound('user');

  const recipientId = recipient._id.toString();
  if (recipientId === callerId) {
    throw badRequest('cannot_friend_self', "You can't friend yourself.");
  }

  // Already friends?
  const { a, b } = canonicalPair(callerId, recipientId);
  const existingFriendship = await Friendship.findOne({ userAId: a, userBId: b });
  if (existingFriendship) {
    throw conflict('already_friends', "You're already friends with this user.");
  }

  // Reverse pending? Auto-accept the existing one.
  const reverse = await FriendRequest.findOne({
    fromUserId: recipientId,
    toUserId: callerId,
    status: 'pending',
  });
  if (reverse) {
    return await acceptRequestById(reverse, callerId, recipient);
  }

  // Already-outgoing pending? Reject — surface as a friendly error so the
  // UI can say "Already sent" rather than create a duplicate.
  const outgoing = await FriendRequest.findOne({
    fromUserId: callerId,
    toUserId: recipientId,
    status: 'pending',
  });
  if (outgoing) {
    throw conflict('request_pending', 'A request is already pending with this user.');
  }

  const created = await FriendRequest.create({
    fromUserId: callerId,
    toUserId: recipientId,
    status: 'pending',
  });

  // Notify the recipient. The caller already has the response inline.
  const callerUser = await User.findById(callerId);
  if (callerUser) {
    const recipientView = toRequestDto(created, recipientId, callerUser);
    friendEvents.emit('request:incoming', {
      toUserId: recipientId,
      request: recipientView,
    } satisfies FriendRequestIncomingEvent);
  }

  return toRequestDto(created, callerId, recipient);
}

export async function listIncomingRequests(callerId: string): Promise<FriendRequestDto[]> {
  const rows = await FriendRequest.find({ toUserId: callerId, status: 'pending' }).sort({
    createdAt: -1,
  });
  const senderIds = Array.from(new Set(rows.map((r) => r.fromUserId.toString())));
  const senders = await User.find({ _id: { $in: senderIds } });
  const byId = new Map(senders.map((u) => [u._id.toString(), u]));

  return rows
    .map((row) => {
      const sender = byId.get(row.fromUserId.toString());
      if (!sender) return null;
      return toRequestDto(row, callerId, sender);
    })
    .filter((r): r is FriendRequestDto => r !== null);
}

export async function listOutgoingRequests(callerId: string): Promise<FriendRequestDto[]> {
  const rows = await FriendRequest.find({ fromUserId: callerId, status: 'pending' }).sort({
    createdAt: -1,
  });
  const recipientIds = Array.from(new Set(rows.map((r) => r.toUserId.toString())));
  const recipients = await User.find({ _id: { $in: recipientIds } });
  const byId = new Map(recipients.map((u) => [u._id.toString(), u]));

  return rows
    .map((row) => {
      const recipient = byId.get(row.toUserId.toString());
      if (!recipient) return null;
      return toRequestDto(row, callerId, recipient);
    })
    .filter((r): r is FriendRequestDto => r !== null);
}

// ── Respond ────────────────────────────────────────────────────────────────

export async function acceptRequest(
  callerId: string,
  requestId: string,
): Promise<FriendRequestDto> {
  const req = await FriendRequest.findById(requestId);
  if (!req) throw notFound('request');
  if (req.toUserId.toString() !== callerId) {
    throw badRequest('not_recipient', 'Only the recipient can accept this request.');
  }
  if (req.status !== 'pending') {
    // Idempotent re-accept — surface a friendly conflict so the UI can refresh.
    throw conflict('request_not_pending', 'This request is no longer pending.');
  }
  const sender = await User.findById(req.fromUserId);
  if (!sender) throw notFound('user');
  return acceptRequestById(req, callerId, sender);
}

/**
 * Shared accept path used by both the explicit accept endpoint and the
 * auto-accept-on-reverse-pending branch of sendFriendRequest. Assumes the
 * caller has already validated that the request is pending and the actor is
 * the recipient. Idempotent against the friendship row.
 */
async function acceptRequestById(
  request: FriendRequestDoc,
  acceptorId: string,
  otherUser: UserDoc,
): Promise<FriendRequestDto> {
  const otherId = otherUser._id.toString();
  const { a, b } = canonicalPair(acceptorId, otherId);

  // Idempotent friendship insert. `upsert: true` paired with `setOnInsert`
  // guarantees a single row even if two accepts race.
  await Friendship.updateOne(
    { userAId: a, userBId: b },
    { $setOnInsert: { userAId: a, userBId: b } },
    { upsert: true },
  );

  request.status = 'accepted';
  request.respondedAt = new Date();
  await request.save();

  const friendship = await Friendship.findOne({ userAId: a, userBId: b });
  const friendedAt = (friendship?.createdAt ?? new Date()).toISOString();

  // Notify the sender (the *other* party of the just-accepted request) so
  // their outgoing list and friends list both update.
  const senderId = request.fromUserId.toString();
  const recipientUser =
    senderId === acceptorId ? otherUser : await User.findById(acceptorId);

  if (recipientUser) {
    const friendForSender: FriendDto = {
      user: toUserDto(senderId === acceptorId ? recipientUser : otherUser),
      friendedAt,
    };
    friendEvents.emit('request:accepted', {
      toUserId: senderId === acceptorId ? otherId : senderId,
      requestId: request._id.toString(),
      newFriend: friendForSender,
    } satisfies FriendRequestRespondedEvent);
  }

  return toRequestDto(request, acceptorId, otherUser);
}

export async function declineRequest(
  callerId: string,
  requestId: string,
): Promise<{ id: string }> {
  const req = await FriendRequest.findById(requestId);
  if (!req) throw notFound('request');
  if (req.toUserId.toString() !== callerId) {
    throw badRequest('not_recipient', 'Only the recipient can decline this request.');
  }
  if (req.status !== 'pending') {
    throw conflict('request_not_pending', 'This request is no longer pending.');
  }
  req.status = 'declined';
  req.respondedAt = new Date();
  await req.save();

  friendEvents.emit('request:declined', {
    toUserId: req.fromUserId.toString(),
    requestId: req._id.toString(),
    newFriend: null,
  } satisfies FriendRequestRespondedEvent);

  return { id: req._id.toString() };
}

export async function cancelRequest(
  callerId: string,
  requestId: string,
): Promise<{ id: string }> {
  const req = await FriendRequest.findById(requestId);
  if (!req) throw notFound('request');
  if (req.fromUserId.toString() !== callerId) {
    throw badRequest('not_sender', 'Only the sender can cancel this request.');
  }
  if (req.status !== 'pending') {
    throw conflict('request_not_pending', 'This request is no longer pending.');
  }
  req.status = 'cancelled';
  req.respondedAt = new Date();
  await req.save();

  friendEvents.emit('request:cancelled', {
    toUserId: req.toUserId.toString(),
    requestId: req._id.toString(),
    newFriend: null,
  } satisfies FriendRequestRespondedEvent);

  return { id: req._id.toString() };
}

// ── Friends list / remove ────────────────────────────────────────────────

export async function listFriends(callerId: string): Promise<FriendDto[]> {
  const edges = await Friendship.find({
    $or: [{ userAId: callerId }, { userBId: callerId }],
  }).sort({ createdAt: -1 });

  const otherIds = edges.map((e) => {
    const a = e.userAId.toString();
    const b = e.userBId.toString();
    return a === callerId ? b : a;
  });

  const others = await User.find({ _id: { $in: otherIds } });
  const byId = new Map(others.map((u) => [u._id.toString(), u]));

  return edges
    .map((edge) => {
      const a = edge.userAId.toString();
      const b = edge.userBId.toString();
      const otherId = a === callerId ? b : a;
      const other = byId.get(otherId);
      if (!other) return null;
      return {
        user: toUserDto(other),
        friendedAt: edge.createdAt.toISOString(),
      } satisfies FriendDto;
    })
    .filter((f): f is FriendDto => f !== null);
}

export async function removeFriend(
  callerId: string,
  otherUserId: string,
): Promise<{ removed: boolean }> {
  if (callerId === otherUserId) {
    throw badRequest('cannot_friend_self', "You can't unfriend yourself.");
  }
  const { a, b } = canonicalPair(callerId, otherUserId);
  const result = await Friendship.deleteOne({ userAId: a, userBId: b });
  const removed = result.deletedCount > 0;

  if (removed) {
    // Notify the other side so their list updates without a refresh.
    friendEvents.emit('removed', {
      toUserId: otherUserId,
      removedUserId: callerId,
    } satisfies FriendRemovedEvent);
  }

  return { removed };
}
