import { Types } from 'mongoose';

import { Channel, Message, ServerMember, User, DmRoom } from '../../db/models/index.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { messageEvents } from './realtime-bridge.js';
import { toMessageDto, type MessageDto } from './schemas.js';
import { dmEvents } from '../dms/realtime-bridge.js';
import { toDmRoomDto } from '../dms/schemas.js';
import { NotificationService } from '../notifications/service.js';
import { serverUnreadEvents } from '../servers/realtime-bridge.js';

/**
 * Authorization gate replacing Supabase RLS: the caller must be a member of the
 * server that owns the channel or a participant of the DM room. Throws `notFound('channel')`
 * for both a missing channel/room and a non-member.
 */
type MessageTarget =
  | { kind: 'channel'; serverId: string }
  | { kind: 'dm'; userAId: string; userBId: string };

async function assertChannelMember(userId: string, channelId: string): Promise<MessageTarget> {
  if (!Types.ObjectId.isValid(channelId)) throw notFound('channel');
  
  // 1. Try finding a server channel
  const channel = await Channel.findById(channelId).select('serverId').lean();
  if (channel) {
    const membership = await ServerMember.findOne({ serverId: channel.serverId, userId }).lean();
    if (!membership) throw notFound('channel');
    return { kind: 'channel', serverId: channel.serverId.toString() };
  }

  // 2. Try finding a DM room
  const dmRoom = await DmRoom.findById(channelId).lean();
  if (dmRoom) {
    if (dmRoom.userAId.toString() !== userId && dmRoom.userBId.toString() !== userId) {
      throw notFound('channel');
    }
    return {
      kind: 'dm',
      userAId: dmRoom.userAId.toString(),
      userBId: dmRoom.userBId.toString(),
    };
  }

  throw notFound('channel');
}

async function resolveMentions(content: string): Promise<Types.ObjectId[]> {
  const usernames = [...content.matchAll(/@(\w+)/g)].map((m) => m[1]!);
  if (usernames.length === 0) return [];
  const users = await User.find({ username: { $in: usernames } })
    .select('_id')
    .lean();
  return users.map((u) => u._id);
}

async function countDmUnreadForUser(args: {
  roomId: string;
  userId: string;
  lastReadAt: Date;
}): Promise<number> {
  return Message.countDocuments({
    channelId: args.roomId,
    authorId: { $ne: new Types.ObjectId(args.userId) },
    deletedAt: null,
    createdAt: { $gt: args.lastReadAt },
  });
}

export async function sendMessage(
  channelId: string,
  authorId: string,
  content: string,
): Promise<MessageDto> {
  const target = await assertChannelMember(authorId, channelId);

  const mentions = await resolveMentions(content);
  const msg = new Message({ channelId, authorId, content, mentions });
  await msg.save();
  await msg.populate('authorId', 'id username displayName avatarUrl');

  // If it's a DM room, update metadata cache
  const dmRoom = await DmRoom.findById(channelId);
  if (dmRoom) {
    dmRoom.lastMessageAt = new Date();
    dmRoom.lastMessagePreview = content.length > 100 ? `${content.slice(0, 97)}...` : content;
    dmRoom.lastMessageAuthorId = new Types.ObjectId(authorId);
    if (dmRoom.userAId.toString() === authorId) {
      dmRoom.userALastReadAt = new Date();
    } else {
      dmRoom.userBLastReadAt = new Date();
    }
    await dmRoom.save();

    await dmRoom.populate('userAId', 'id username displayName avatarUrl');
    await dmRoom.populate('userBId', 'id username displayName avatarUrl');

    const userAId = (dmRoom.userAId as any)._id?.toString() || dmRoom.userAId.toString();
    const userBId = (dmRoom.userBId as any)._id?.toString() || dmRoom.userBId.toString();
    const [userAUnreadCount, userBUnreadCount] = await Promise.all([
      countDmUnreadForUser({
        roomId: dmRoom.id,
        userId: userAId,
        lastReadAt: dmRoom.userALastReadAt,
      }),
      countDmUnreadForUser({
        roomId: dmRoom.id,
        userId: userBId,
        lastReadAt: dmRoom.userBLastReadAt,
      }),
    ]);
    dmEvents.emit('room:updated', {
      toUserId: userAId,
      room: toDmRoomDto(dmRoom, userAId, userAUnreadCount),
    });
    dmEvents.emit('room:updated', {
      toUserId: userBId,
      room: toDmRoomDto(dmRoom, userBId, userBUnreadCount),
    });
  }

  const isDm = target.kind === 'dm';

  if (isDm) {
    const recipientId = target.userAId === authorId ? target.userBId : target.userAId;
    await NotificationService.createDMNotification({
      userId: recipientId,
      channelId,
      messageId: msg.id,
      fromUserId: authorId,
    });
  } else {
    const uniqueMentionedUserIds = new Set(mentions.map((id) => id.toString()));
    const mentionedMembers = await ServerMember.find({
      serverId: target.serverId,
      userId: { $in: Array.from(uniqueMentionedUserIds) },
    })
      .select('userId')
      .lean();
    const notifiableUserIds = mentionedMembers.map((member) => member.userId.toString());

    await Promise.all(
      notifiableUserIds.map((userId) =>
        NotificationService.createMentionNotification({
          userId,
          serverId: target.serverId,
          channelId,
          messageId: msg.id,
          fromUserId: authorId,
        }),
      ),
    );
  }

  const dto = toMessageDto(msg);
  messageEvents.emit('message:created', {
    channelId,
    isDm,
    message: dto,
    ...(target.kind === 'channel' ? { serverId: target.serverId } : {}),
  });
  if (target.kind === 'channel') {
    serverUnreadEvents.emit('changed', {
      serverId: target.serverId,
      channelId,
    });
  }
  return dto;
}

export async function getMessages(
  userId: string,
  channelId: string,
  options: { before?: string; limit: number },
): Promise<{ messages: MessageDto[]; hasMore: boolean }> {
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

  return { messages: messages.map(toMessageDto), hasMore };
}

export async function updateMessage(
  messageId: string,
  userId: string,
  content: string,
): Promise<MessageDto> {
  const msg = await Message.findById(messageId);
  if (!msg || msg.deletedAt) throw notFound('message');

  const target = await assertChannelMember(userId, msg.channelId);
  if (msg.authorId.toString() !== userId) throw forbidden();

  msg.content = content;
  msg.editedAt = new Date();
  msg.mentions = await resolveMentions(content);

  await msg.save();
  await msg.populate('authorId', 'id username displayName avatarUrl');

  const dto = toMessageDto(msg);
  messageEvents.emit('message:updated', {
    channelId: msg.channelId,
    isDm: target.kind === 'dm',
    message: dto,
  });
  return dto;
}

export async function deleteMessage(messageId: string, userId: string): Promise<void> {
  const msg = await Message.findById(messageId);
  if (!msg || msg.deletedAt) throw notFound('message');

  const target = await assertChannelMember(userId, msg.channelId);
  if (msg.authorId.toString() !== userId) throw forbidden();

  msg.deletedAt = new Date();
  await msg.save();

  messageEvents.emit('message:deleted', {
    channelId: msg.channelId,
    isDm: target.kind === 'dm',
    messageId: msg.id,
  });
}

export async function addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  const msg = await Message.findById(messageId);
  if (!msg || msg.deletedAt) throw notFound('message');

  const target = await assertChannelMember(userId, msg.channelId);

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
    isDm: target.kind === 'dm',
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

  const target = await assertChannelMember(userId, msg.channelId);

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
    isDm: target.kind === 'dm',
    messageId: msg.id,
    emoji,
    userId,
  });
}
