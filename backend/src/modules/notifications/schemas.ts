import { z } from 'zod';

import type { NotificationDoc, NotificationType } from '../../db/models/index.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const notificationIdParam = z.object({
  notificationId: objectId,
});

export const notificationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  unreadOnly: z.coerce.boolean().default(false),
});

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  serverId: string | null;
  channelId: string | null;
  messageId: string | null;
  fromUserId: string | null;
  read: boolean;
  createdAt: string;
}

export function toNotificationDto(doc: NotificationDoc): NotificationDto {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    type: doc.type,
    serverId: doc.serverId ? doc.serverId.toString() : null,
    channelId: doc.channelId ?? null,
    messageId: doc.messageId ? doc.messageId.toString() : null,
    fromUserId: doc.fromUserId ? doc.fromUserId.toString() : null,
    read: doc.read,
    createdAt: doc.createdAt.toISOString(),
  };
}
