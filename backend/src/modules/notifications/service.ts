import { Types } from 'mongoose';

import { Notification, type NotificationType } from '../../db/models/index.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { notificationEvents } from './realtime-bridge.js';
import { toNotificationDto, type NotificationDto } from './schemas.js';

interface CreateNotificationArgs {
  userId: string;
  type: NotificationType;
  serverId?: string | null;
  channelId?: string | null;
  messageId?: string | null;
  fromUserId?: string | null;
}

interface CreateMentionArgs {
  userId: string;
  serverId?: string | null;
  channelId: string;
  messageId: string;
  fromUserId: string;
}

interface CreateDmArgs {
  userId: string;
  channelId: string;
  messageId: string;
  fromUserId: string;
}

function objectIdOrNull(value: string | null | undefined): Types.ObjectId | null {
  return value ? new Types.ObjectId(value) : null;
}

class NotificationServiceImpl {
  async createNotification(args: CreateNotificationArgs): Promise<NotificationDto> {
    if (args.fromUserId && args.fromUserId === args.userId) {
      throw forbidden('Cannot notify yourself');
    }

    const doc = await Notification.create({
      userId: new Types.ObjectId(args.userId),
      type: args.type,
      serverId: objectIdOrNull(args.serverId),
      channelId: args.channelId ?? null,
      messageId: objectIdOrNull(args.messageId),
      fromUserId: objectIdOrNull(args.fromUserId),
      read: false,
    });

    const dto = toNotificationDto(doc);
    notificationEvents.emit('notification:created', { toUserId: args.userId, notification: dto });
    return dto;
  }

  async createMentionNotification(args: CreateMentionArgs): Promise<NotificationDto | null> {
    if (args.userId === args.fromUserId) return null;

    return this.createNotification({
      userId: args.userId,
      type: 'mention',
      serverId: args.serverId ?? null,
      channelId: args.channelId,
      messageId: args.messageId,
      fromUserId: args.fromUserId,
    });
  }

  async createDMNotification(args: CreateDmArgs): Promise<NotificationDto | null> {
    if (args.userId === args.fromUserId) return null;

    return this.createNotification({
      userId: args.userId,
      type: 'dm',
      serverId: null,
      channelId: args.channelId,
      messageId: args.messageId,
      fromUserId: args.fromUserId,
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const doc = await Notification.findById(notificationId);
    if (!doc) throw notFound('notification');
    if (doc.userId.toString() !== userId) throw forbidden();

    if (!doc.read) {
      doc.read = true;
      await doc.save();
    }

    const dto = toNotificationDto(doc);
    notificationEvents.emit('notification:updated', { toUserId: userId, notification: dto });
    return dto;
  }

  async getUserNotifications(
    userId: string,
    options: { limit: number; unreadOnly?: boolean },
  ): Promise<NotificationDto[]> {
    const docs = await Notification.find({
      userId,
      ...(options.unreadOnly ? { read: false } : {}),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(options.limit)
      .exec();

    return docs.map(toNotificationDto);
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const doc = await Notification.findById(notificationId);
    if (!doc) throw notFound('notification');
    if (doc.userId.toString() !== userId) throw forbidden();

    await Notification.deleteOne({ _id: notificationId });
    notificationEvents.emit('notification:deleted', { toUserId: userId, notificationId });
  }

  async deleteReadNotifications(userId: string): Promise<number> {
    const result = await Notification.deleteMany({ userId, read: true });
    notificationEvents.emit('notification:read-cleared', { toUserId: userId });
    return result.deletedCount ?? 0;
  }
}

export const NotificationService = new NotificationServiceImpl();
