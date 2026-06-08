import { z } from 'zod';
import type { DmRoomDoc, UserDoc } from '../../db/models/index.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createDmRoomBody = z.object({
  recipientId: objectId,
});

export const dmRoomIdParam = z.object({
  dmRoomId: objectId,
});

export interface DmRecipientDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface DmRoomDto {
  id: string;
  recipient: DmRecipientDto;
  unreadCount?: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageAuthorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toDmRoomDto(doc: DmRoomDoc, currentUserId: string, unreadCount?: number): DmRoomDto {
  // Check which user is the recipient (the one who is NOT the current logged-in user)
  const userAIdStr = (doc.userAId as any)._id?.toString() || doc.userAId.toString();
  const isA = userAIdStr === currentUserId;
  const recipientDoc = (isA ? doc.userBId : doc.userAId) as any as UserDoc; // Cast to access populated values

  const recipient: DmRecipientDto = {
    id: recipientDoc._id?.toString() || recipientDoc.id,
    username: recipientDoc.username || 'Someone',
    displayName: recipientDoc.displayName || null,
    avatarUrl: recipientDoc.avatarUrl || null,
  };

  return {
    id: doc._id.toString(),
    recipient,
    unreadCount,
    lastMessageAt: doc.lastMessageAt ? doc.lastMessageAt.toISOString() : null,
    lastMessagePreview: doc.lastMessagePreview ?? null,
    lastMessageAuthorId: doc.lastMessageAuthorId ? doc.lastMessageAuthorId.toString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
