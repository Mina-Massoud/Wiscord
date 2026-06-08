import { Types } from 'mongoose';
import { describe, expect, test } from 'vitest';

import { createDmRoomBody, dmRoomIdParam, toDmRoomDto } from '../../src/modules/dms/schemas.js';

const USER_A_ID = '507f1f77bcf86cd799439011';
const USER_B_ID = '507f1f77bcf86cd799439012';
const ROOM_ID = '507f1f77bcf86cd799439013';

function makeRoomDoc() {
  return {
    _id: new Types.ObjectId(ROOM_ID),
    userAId: {
      _id: new Types.ObjectId(USER_A_ID),
      username: 'mina',
      displayName: 'Mina',
      avatarUrl: null,
    },
    userBId: {
      _id: new Types.ObjectId(USER_B_ID),
      username: 'nour',
      displayName: null,
      avatarUrl: 'https://example.com/avatar.png',
    },
    lastMessageAt: new Date('2026-06-08T10:00:00.000Z'),
    lastMessagePreview: 'hello',
    lastMessageAuthorId: new Types.ObjectId(USER_B_ID),
    createdAt: new Date('2026-06-08T09:00:00.000Z'),
    updatedAt: new Date('2026-06-08T10:00:00.000Z'),
  } as any;
}

describe('DM schemas', () => {
  test('accepts valid ObjectId params', () => {
    expect(createDmRoomBody.parse({ recipientId: USER_B_ID }).recipientId).toBe(USER_B_ID);
    expect(dmRoomIdParam.parse({ dmRoomId: ROOM_ID }).dmRoomId).toBe(ROOM_ID);
  });

  test('rejects malformed ids', () => {
    expect(() => createDmRoomBody.parse({ recipientId: 'nope' })).toThrow();
    expect(() => dmRoomIdParam.parse({ dmRoomId: '1234' })).toThrow();
  });

  test('serializes the other participant as the recipient when ids are populated', () => {
    const dto = toDmRoomDto(makeRoomDoc(), USER_A_ID, 3);

    expect(dto.id).toBe(ROOM_ID);
    expect(dto.recipient).toEqual({
      id: USER_B_ID,
      username: 'nour',
      displayName: null,
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(dto.unreadCount).toBe(3);
    expect(dto.lastMessageAt).toBe('2026-06-08T10:00:00.000Z');
    expect(dto.lastMessageAuthorId).toBe(USER_B_ID);
  });

  test('chooses user A as the recipient when the current user is user B', () => {
    const dto = toDmRoomDto(makeRoomDoc(), USER_B_ID);

    expect(dto.recipient.id).toBe(USER_A_ID);
    expect(dto.recipient.username).toBe('mina');
  });
});
