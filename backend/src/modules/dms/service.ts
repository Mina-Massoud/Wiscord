import { Types } from 'mongoose';
import { DmRoom, User, Message, canonicalDmPair } from '../../db/models/index.js';
import { notFound, forbidden } from '../../lib/errors.js';
import { toDmRoomDto, type DmRoomDto } from './schemas.js';
import { dmEvents } from './realtime-bridge.js';

export async function getOrCreateDmRoom(userId: string, recipientId: string): Promise<DmRoomDto> {
  if (userId === recipientId) {
    throw forbidden('You cannot start a DM with yourself');
  }

  // Ensure recipient exists
  const recipient = await User.findById(recipientId).lean();
  if (!recipient) {
    throw notFound('user');
  }

  const { a, b } = canonicalDmPair(userId, recipientId);

  let room = await DmRoom.findOne({ userAId: a, userBId: b });
  const wasCreated = !room;
  if (!room) {
    room = new DmRoom({
      userAId: new Types.ObjectId(a),
      userBId: new Types.ObjectId(b),
      userALastReadAt: new Date(),
      userBLastReadAt: new Date(),
    });
    await room.save();
  }

  // Populate recipient info
  await room.populate('userAId', 'id username displayName avatarUrl');
  await room.populate('userBId', 'id username displayName avatarUrl');

  const callerDto = toDmRoomDto(room, userId);

  if (wasCreated) {
    dmEvents.emit('room:updated', { toUserId: userId, room: callerDto });
    dmEvents.emit('room:updated', {
      toUserId: recipientId,
      room: toDmRoomDto(room, recipientId),
    });
  }

  return callerDto;
}

export async function listDmRooms(userId: string): Promise<DmRoomDto[]> {
  const rooms = await DmRoom.find({
    $or: [{ userAId: userId }, { userBId: userId }],
  })
    .populate('userAId', 'id username displayName avatarUrl')
    .populate('userBId', 'id username displayName avatarUrl')
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .exec();

  const dtos: DmRoomDto[] = [];

  for (const room of rooms) {
    // Calculate unread count
    const userAIdStr = (room.userAId as any)._id?.toString() || room.userAId.toString();
    const isA = userAIdStr === userId;
    const lastReadAt = isA ? room.userALastReadAt : room.userBLastReadAt;

    const unreadCount = await Message.countDocuments({
      channelId: room.id,
      authorId: { $ne: new Types.ObjectId(userId) },
      deletedAt: null,
      createdAt: { $gt: lastReadAt },
    });

    dtos.push(toDmRoomDto(room, userId, unreadCount));
  }

  // Sort: rooms with messages (lastMessageAt) come first, sorted by lastMessageAt desc;
  // then rooms with no messages sorted by updatedAt desc.
  return dtos.sort((x, y) => {
    const timeX = x.lastMessageAt ? new Date(x.lastMessageAt).getTime() : new Date(x.updatedAt).getTime();
    const timeY = y.lastMessageAt ? new Date(y.lastMessageAt).getTime() : new Date(y.updatedAt).getTime();
    return timeY - timeX;
  });
}

export async function getDmRoomDetail(userId: string, dmRoomId: string): Promise<DmRoomDto> {
  const room = await DmRoom.findById(dmRoomId)
    .populate('userAId', 'id username displayName avatarUrl')
    .populate('userBId', 'id username displayName avatarUrl')
    .exec();

  if (!room) {
    throw notFound('dm_room');
  }

  const userAIdStr = (room.userAId as any)._id?.toString() || room.userAId.toString();
  const userBIdStr = (room.userBId as any)._id?.toString() || room.userBId.toString();
  const isParticipant = userAIdStr === userId || userBIdStr === userId;
  if (!isParticipant) {
    throw forbidden();
  }

  return toDmRoomDto(room, userId);
}

export async function markDmRoomAsRead(userId: string, dmRoomId: string): Promise<void> {
  const room = await DmRoom.findById(dmRoomId);
  if (!room) {
    throw notFound('dm_room');
  }

  const isA = room.userAId.toString() === userId;
  const isB = room.userBId.toString() === userId;

  if (!isA && !isB) {
    throw forbidden();
  }

  if (isA) {
    room.userALastReadAt = new Date();
  } else {
    room.userBLastReadAt = new Date();
  }

  await room.save();

  await room.populate('userAId', 'id username displayName avatarUrl');
  await room.populate('userBId', 'id username displayName avatarUrl');
  dmEvents.emit('room:updated', { toUserId: userId, room: toDmRoomDto(room, userId, 0) });
}
