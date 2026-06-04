import { Types } from 'mongoose';

import {
  Channel,
  Message,
  ServerMember,
  User,
  type MessageDoc,
} from '../../db/models/index.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { messageEvents } from './realtime-bridge.js';

/**
 * Authorization gate replacing Supabase RLS: the caller must be a member of the
 * server that owns the channel. Throws `notFound('channel')` for both a missing
 * channel and a non-member, so we never confirm a channel's existence to someone
 * who has no access to it.
 */
async function assertChannelMember(userId: string, channelId: string): Promise<void> {
  if (!Types.ObjectId.isValid(channelId)) throw notFound('channel');
  const channel = await Channel.findById(channelId).select('serverId').lean();
  if (!channel) throw notFound('channel');
  const membership = await ServerMember.findOne({ serverId: channel.serverId, userId }).lean();
  if (!membership) throw notFound('channel');
}

async function resolveMentions(content: string): Promise<Types.ObjectId[]> {
  const usernames = [...content.matchAll(/@(\w+)/g)].map((m) => m[1]!);
  if (usernames.length === 0) return [];
  const users = await User.find({ username: { $in: usernames } })
    .select('_id')
    .lean();
  return users.map((u) => u._id);
}

export async function sendMessage(
  channelId: string,
  authorId: string,
  content: string,
): Promise<MessageDoc> {
  await assertChannelMember(authorId, channelId);

  const mentions = await resolveMentions(content);
  const msg = new Message({ channelId, authorId, content, mentions });
  await msg.save();
  await msg.populate('authorId', 'id username displayName avatarUrl');

  messageEvents.emit('message:created', { channelId, message: msg });
  return msg;
}

export async function getMessages(
  userId: string,
  channelId: string,
  options: { before?: string; limit: number },
): Promise<{ messages: MessageDoc[]; hasMore: boolean }> {
  await assertChannelMember(userId, channelId);

  const query: { channelId: string; deletedAt: null; createdAt?: { $lt: Date } } = {
    channelId,
    deletedAt: null,
  };
  if (options.before) {
    // `before` is validated as an ISO datetime by the route schema.
    query.createdAt = { $lt: new Date(options.before) };
  }

  const messages = await Message.find(query)
    // `_id` tiebreaker keeps pagination stable for same-millisecond messages.
    .sort({ createdAt: -1, _id: -1 })
    .limit(options.limit + 1)
    .populate('authorId', 'id username displayName avatarUrl')
    .exec();

  const hasMore = messages.length > options.limit;
  if (hasMore) messages.pop();

  return { messages, hasMore };
}

export async function updateMessage(
  messageId: string,
  userId: string,
  content: string,
): Promise<MessageDoc> {
  const msg = await Message.findById(messageId);
  if (!msg || msg.deletedAt) throw notFound('message');

  await assertChannelMember(userId, msg.channelId);
  if (msg.authorId.toString() !== userId) throw forbidden();

  msg.content = content;
  msg.editedAt = new Date();
  msg.mentions = await resolveMentions(content);

  await msg.save();
  await msg.populate('authorId', 'id username displayName avatarUrl');

  messageEvents.emit('message:updated', { channelId: msg.channelId, message: msg });
  return msg;
}

export async function deleteMessage(messageId: string, userId: string): Promise<void> {
  const msg = await Message.findById(messageId);
  if (!msg || msg.deletedAt) throw notFound('message');

  await assertChannelMember(userId, msg.channelId);
  if (msg.authorId.toString() !== userId) throw forbidden();

  msg.deletedAt = new Date();
  await msg.save();

  messageEvents.emit('message:deleted', { channelId: msg.channelId, messageId: msg.id });
}

export async function addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  const msg = await Message.findById(messageId);
  if (!msg || msg.deletedAt) throw notFound('message');

  await assertChannelMember(userId, msg.channelId);

  const uid = new Types.ObjectId(userId);
  const existing = msg.reactions.find((r) => r.emoji === emoji);
  if (existing) {
    if (existing.userIds.some((id) => id.equals(uid))) return; // already reacted
    existing.userIds.push(uid);
  } else {
    msg.reactions.push({ emoji, userIds: [uid] });
  }

  await msg.save();
  messageEvents.emit('message:reaction_added', {
    channelId: msg.channelId,
    messageId: msg.id,
    emoji,
    userId,
  });
}

export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const msg = await Message.findById(messageId);
  if (!msg || msg.deletedAt) throw notFound('message');

  await assertChannelMember(userId, msg.channelId);

  const uid = new Types.ObjectId(userId);
  const ridx = msg.reactions.findIndex((r) => r.emoji === emoji);
  if (ridx === -1) return;

  const reaction = msg.reactions[ridx]!;
  const uidx = reaction.userIds.findIndex((id) => id.equals(uid));
  if (uidx === -1) return;

  reaction.userIds.splice(uidx, 1);
  if (reaction.userIds.length === 0) msg.reactions.splice(ridx, 1);

  await msg.save();
  messageEvents.emit('message:reaction_removed', {
    channelId: msg.channelId,
    messageId: msg.id,
    emoji,
    userId,
  });
}
