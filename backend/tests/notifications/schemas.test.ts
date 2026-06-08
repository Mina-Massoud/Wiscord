import { Types } from 'mongoose';
import { describe, expect, test } from 'vitest';

import {
  notificationIdParam,
  notificationsQuery,
  toNotificationDto,
} from '../../src/modules/notifications/schemas.js';

const USER_ID = '507f1f77bcf86cd799439011';
const NOTIFICATION_ID = '507f1f77bcf86cd799439012';
const SERVER_ID = '507f1f77bcf86cd799439013';
const CHANNEL_ID = '507f1f77bcf86cd799439014';
const MESSAGE_ID = '507f1f77bcf86cd799439015';
const FROM_USER_ID = '507f1f77bcf86cd799439016';

describe('notification schemas', () => {
  test('accepts valid notification ids', () => {
    expect(notificationIdParam.parse({ notificationId: NOTIFICATION_ID }).notificationId).toBe(
      NOTIFICATION_ID,
    );
  });

  test('rejects malformed ids', () => {
    expect(() => notificationIdParam.parse({ notificationId: 'bad' })).toThrow();
  });

  test('coerces notification query options', () => {
    const parsed = notificationsQuery.parse({ limit: '10', unreadOnly: 'true' });
    expect(parsed).toEqual({ limit: 10, unreadOnly: true });
  });

  test('serializes notification documents', () => {
    const dto = toNotificationDto({
      _id: new Types.ObjectId(NOTIFICATION_ID),
      userId: new Types.ObjectId(USER_ID),
      type: 'mention',
      serverId: new Types.ObjectId(SERVER_ID),
      channelId: CHANNEL_ID,
      messageId: new Types.ObjectId(MESSAGE_ID),
      fromUserId: new Types.ObjectId(FROM_USER_ID),
      read: false,
      createdAt: new Date('2026-06-08T10:00:00.000Z'),
    } as any);

    expect(dto).toEqual({
      id: NOTIFICATION_ID,
      userId: USER_ID,
      type: 'mention',
      serverId: SERVER_ID,
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
      fromUserId: FROM_USER_ID,
      read: false,
      createdAt: '2026-06-08T10:00:00.000Z',
    });
  });
});
