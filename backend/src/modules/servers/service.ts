import {
  Channel,
  ChannelMember,
  EventRsvp,
  Invite,
  Message,
  Server,
  ServerEvent,
  ServerMember,
  type ChannelDoc,
  type ServerMemberRole,
  type ServerDoc,
  type UserDoc,
} from '../../db/models/index.js';
import { Types } from 'mongoose';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { createDefaultInviteForServer } from '../invites/service.js';
import { serverUnreadEvents } from './realtime-bridge.js';
import type { ChannelDto, CreateChannelBody, CreateServerBody, ServerDto, ServerMemberDto, ServerUnreadDto, UpdateChannelBody, UpdateServerBody } from './schemas.js';

function toServerDto(doc: ServerDoc): ServerDto {
  return {
    id: doc._id.toString(),
    name: doc.name,
    iconUrl: doc.iconUrl ?? null,
    ownerId: doc.ownerId.toString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

function toChannelDto(doc: ChannelDoc, unreadCount?: number): ChannelDto {
  return {
    id: doc._id.toString(),
    serverId: doc.serverId.toString(),
    name: doc.name,
    type: doc.type,
    position: doc.position,
    createdAt: doc.createdAt.toISOString(),
    unreadCount,
  };
}

function toServerMemberDto(doc: {
  _id: Types.ObjectId;
  serverId: Types.ObjectId;
  userId: UserDoc;
  role: ServerMemberRole;
}): ServerMemberDto {
  return {
    id: doc._id.toString(),
    serverId: doc.serverId.toString(),
    userId: doc.userId._id.toString(),
    role: doc.role,
    user: {
      id: doc.userId._id.toString(),
      username: doc.userId.username,
      displayName: doc.userId.displayName ?? null,
      avatarUrl: doc.userId.avatarUrl ?? null,
    },
  };
}

async function assertServerMember(userId: string, serverId: string): Promise<void> {
  const membership = await ServerMember.findOne({ serverId, userId }).lean();
  if (!membership) {
    throw notFound('server');
  }
}

/**
 * Servers the caller is a member of, newest first.
 */
export async function listServersForUser(userId: string): Promise<ServerDto[]> {
  const memberships = await ServerMember.find({ userId }).select('serverId').lean();
  if (memberships.length === 0) return [];

  const serverIds = memberships.map((m) => m.serverId);
  const servers = await Server.find({ _id: { $in: serverIds } })
    .sort({ createdAt: -1 })
    .exec();

  return servers.map((doc) => toServerDto(doc));
}

/**
 * Creates a server, adds the caller as owner, and seeds default text + voice channels.
 */
export async function createServer(
  userId: string,
  body: CreateServerBody,
): Promise<{ server: ServerDto; channels: ChannelDto[] }> {
  const server = await Server.create({
    name: body.name,
    iconUrl: body.iconUrl ?? null,
    ownerId: userId,
  });
  await ServerMember.create({ serverId: server._id, userId, role: 'owner' });

  const textChannel = await Channel.create({
    serverId: server._id,
    name: 'general',
    type: 'text',
    position: 0,
  });
  const voiceChannel = await Channel.create({
    serverId: server._id,
    // Stored as a normalized slug so the seed obeys the same {serverId,name}
    // uniqueness contract that createChannel/updateChannel enforce.
    name: 'focus-room',
    type: 'voice',
    position: 1,
  });

  await createDefaultInviteForServer(server._id.toString(), userId);

  return {
    server: toServerDto(server),
    channels: [toChannelDto(textChannel), toChannelDto(voiceChannel)],
  };
}

export async function getServerForMember(
  userId: string,
  serverId: string,
): Promise<ServerDto | null> {
  await assertServerMember(userId, serverId);
  const server = await Server.findById(serverId).exec();
  if (!server) return null;
  return toServerDto(server);
}

export async function listMembersForServer(
  userId: string,
  serverId: string,
): Promise<ServerMemberDto[]> {
  await assertServerMember(userId, serverId);

  const members = await ServerMember.find({ serverId })
    .sort({ createdAt: 1, _id: 1 })
    .populate<{ userId: UserDoc }>('userId', 'username displayName avatarUrl')
    .exec();

  return members.map((member) => toServerMemberDto(member));
}

/**
 * Updates a server's name and/or icon. Only the owner may do this.
 */
export async function updateServer(
  userId: string,
  serverId: string,
  body: UpdateServerBody,
): Promise<ServerDto> {
  const server = await Server.findById(serverId).exec();
  if (!server) throw notFound('server');

  const membership = await ServerMember.findOne({ serverId, userId }).lean();
  if (!membership) throw notFound('server');
  if (server.ownerId.toString() !== userId) throw forbidden('Only the server owner can edit server settings.');

  if (body.name !== undefined) server.name = body.name;
  if (body.iconUrl !== undefined) server.iconUrl = body.iconUrl;
  await server.save();
  return toServerDto(server);
}

export async function listChannelsForServer(
  userId: string,
  serverId: string,
): Promise<ChannelDto[]> {
  await assertServerMember(userId, serverId);
  const channels = await Channel.find({ serverId }).sort({ position: 1 }).exec();

  // Get all channel members for this user in this server's channels
  const channelIds = channels.map((c) => c._id);
  const channelMembers = await ChannelMember.find({
    channelId: { $in: channelIds },
    userId,
  }).lean();

  const lastReadMap = new Map<string, Date>();
  for (const cm of channelMembers) {
    lastReadMap.set(cm.channelId.toString(), cm.lastReadAt);
  }

  const dtos: ChannelDto[] = [];
  for (const channel of channels) {
    const channelIdStr = channel._id.toString();
    const lastReadAt = lastReadMap.get(channelIdStr);

    const unreadCount = await Message.countDocuments({
      channelId: channelIdStr,
      authorId: { $ne: new Types.ObjectId(userId) },
      deletedAt: null,
      ...(lastReadAt ? { createdAt: { $gt: lastReadAt } } : {}),
    });

    dtos.push(toChannelDto(channel, unreadCount));
  }

  return dtos;
}

function normalizeChannelName(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug.length < 2) {
    throw badRequest('invalid_channel_name', 'Channel name needs at least 2 characters.');
  }
  return slug;
}

/**
 * Adds a text or voice channel to a server. Any member may create for now.
 * Names are unique per server (case-insensitive slug).
 */
export async function createChannel(
  userId: string,
  serverId: string,
  body: CreateChannelBody,
): Promise<ChannelDto> {
  await assertServerMember(userId, serverId);

  const name = normalizeChannelName(body.name);
  const existing = await Channel.findOne({ serverId, name }).lean();
  if (existing) {
    throw conflict('channel_name_taken', 'That channel name is already in use.');
  }

  const last = await Channel.findOne({ serverId, type: body.type })
    .sort({ position: -1 })
    .lean();
  const position = (last?.position ?? -1) + 1;

  const channel = await Channel.create({
    serverId,
    name,
    type: body.type,
    position,
  });

  return toChannelDto(channel, 0);
}

/**
 * Renames a channel. Owner-only. Slug-normalises the name and
 * checks for collisions within the same server.
 */
export async function updateChannel(
  userId: string,
  serverId: string,
  channelId: string,
  body: UpdateChannelBody,
): Promise<ChannelDto> {
  const server = await Server.findById(serverId).exec();
  if (!server) throw notFound('server');

  const membership = await ServerMember.findOne({ serverId, userId }).lean();
  if (!membership) throw notFound('server');
  if (server.ownerId.toString() !== userId) throw forbidden('Only the server owner can rename channels.');

  const channel = await Channel.findOne({ _id: channelId, serverId }).exec();
  if (!channel) throw notFound('channel');

  if (body.name !== undefined) {
    const slug = normalizeChannelName(body.name);
    const conflict2 = await Channel.findOne({ serverId, name: slug, _id: { $ne: channelId } }).lean();
    if (conflict2) throw conflict('channel_name_taken', 'That channel name is already in use.');
    channel.name = slug;
  }

  await channel.save();
  return toChannelDto(channel);
}

/**
 * Deletes a channel. Owner-only. Prevents deleting the very last channel in a server.
 */
export async function deleteChannel(
  userId: string,
  serverId: string,
  channelId: string,
): Promise<void> {
  const server = await Server.findById(serverId).exec();
  if (!server) throw notFound('server');

  const membership = await ServerMember.findOne({ serverId, userId }).lean();
  if (!membership) throw notFound('server');
  if (server.ownerId.toString() !== userId) throw forbidden('Only the server owner can delete channels.');

  const channel = await Channel.findOne({ _id: channelId, serverId }).exec();
  if (!channel) throw notFound('channel');

  const totalChannels = await Channel.countDocuments({ serverId });
  if (totalChannels <= 1) throw badRequest('last_channel', 'You cannot delete the last channel in a server.');

  await channel.deleteOne();
}


export async function deleteServer(userId: string, serverId: string): Promise<void> {
  const server = await Server.findById(serverId).exec();
  if (!server) throw notFound('server');

  const membership = await ServerMember.findOne({ serverId, userId }).lean();
  if (!membership) throw notFound('server');
  if (membership.role !== 'owner') throw forbidden('Only the server owner can delete this server.');

  // Collect event ids first so their RSVPs can be swept too.
  const events = await ServerEvent.find({ serverId }).select('_id').lean();
  const eventIds = events.map((e) => e._id);

  await Promise.all([
    server.deleteOne(),
    ServerMember.deleteMany({ serverId }),
    Channel.deleteMany({ serverId }),
    Invite.deleteMany({ serverId }),
    ServerEvent.deleteMany({ serverId }),
    EventRsvp.deleteMany({ eventId: { $in: eventIds } }),
  ]);
}

export async function leaveServer(userId: string, serverId: string): Promise<void> {
  const membership = await ServerMember.findOne({ serverId, userId }).lean();
  if (!membership) throw notFound('server');
  if (membership.role === 'owner') {
    throw badRequest('owner_cannot_leave', 'Transfer ownership before leaving, or delete the server.');
  }
  await ServerMember.deleteOne({ serverId, userId });
}

export async function markChannelAsRead(userId: string, serverId: string, channelId: string): Promise<void> {
  await assertServerMember(userId, serverId);

  const channel = await Channel.findOne({ _id: channelId, serverId }).exec();
  if (!channel) throw notFound('channel');

  await ChannelMember.findOneAndUpdate(
    { channelId: channel._id, userId },
    { lastReadAt: new Date() },
    { upsert: true, new: true },
  );

  serverUnreadEvents.emit('changed', {
    serverId,
    channelId: channel._id.toString(),
  });
}

export async function getServersUnread(userId: string): Promise<ServerUnreadDto[]> {
  const memberships = await ServerMember.find({ userId }).select('serverId').lean();
  if (memberships.length === 0) return [];

  const serverIds = memberships.map((m) => m.serverId);
  const servers = await Server.find({ _id: { $in: serverIds } }).exec();

  const results: ServerUnreadDto[] = [];

  for (const server of servers) {
    const serverId = server._id.toString();
    const channels = await Channel.find({ serverId }).select('_id').exec();
    const channelIds = channels.map((c) => c._id);

    const channelMembers = await ChannelMember.find({
      channelId: { $in: channelIds },
      userId,
    }).lean();

    const lastReadMap = new Map<string, Date>();
    for (const cm of channelMembers) {
      lastReadMap.set(cm.channelId.toString(), cm.lastReadAt);
    }

    let totalUnread = 0;
    for (const channel of channels) {
      const channelIdStr = channel._id.toString();
      const lastReadAt = lastReadMap.get(channelIdStr);

      const unreadCount = await Message.countDocuments({
        channelId: channelIdStr,
        authorId: { $ne: new Types.ObjectId(userId) },
        deletedAt: null,
        ...(lastReadAt ? { createdAt: { $gt: lastReadAt } } : {}),
      });

      totalUnread += unreadCount;
    }

    results.push({
      serverId,
      hasUnread: totalUnread > 0,
      unreadCount: totalUnread,
    });
  }

  return results;
}
