import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

export const NOTIFICATION_TYPES = ['mention', 'dm', 'system'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', default: null },
    channelId: { type: String, default: null },
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'notifications' },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ messageId: 1, userId: 1, type: 1 });

applySerialize(notificationSchema);

export type NotificationRow = InferSchemaType<typeof notificationSchema>;
export type NotificationDoc = HydratedDocument<NotificationRow>;
export const Notification = model('Notification', notificationSchema);
