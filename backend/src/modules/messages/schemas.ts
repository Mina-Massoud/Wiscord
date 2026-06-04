import { Types } from 'mongoose';
import { z } from 'zod';

import type { MessageDoc } from '../../db/models/index.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const sendMessageBody = z.object({
  content: z.string().min(1).max(4000),
});

export const updateMessageBody = z.object({
  content: z.string().min(1).max(4000),
});

export const messagesQuery = z.object({
  // ISO 8601 cursor (the createdAt of the oldest loaded message).
  before: z.string().datetime({ message: 'before must be an ISO 8601 datetime' }).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const channelIdParam = z.object({
  channelId: objectId,
});

export const messageIdParam = z.object({
  messageId: objectId,
});

export const addReactionBody = z.object({
  // Real emoji are a handful of codepoints; cap tightly to prevent document bloat.
  emoji: z.string().min(1).max(16),
});

export const reactionParams = z.object({
  messageId: objectId,
  emoji: z.string().min(1).max(16),
});

// ── Output DTO ────────────────────────────────────────────────────────────────
// The frontend never sees raw Mongoose docs. `toMessageDto` produces a stable
// wire shape: `authorId` is always a string, the populated author rides on a
// separate `author` object, and ids/dates are serialized — so the client never
// has to defend against a populated-vs-raw `authorId`.

export interface MessageAuthorDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface MessageDto {
  id: string;
  channelId: string;
  authorId: string;
  author: MessageAuthorDto | null;
  content: string;
  mentions: string[];
  reactions: { emoji: string; userIds: string[] }[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PopulatedAuthor {
  _id: Types.ObjectId;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

function isPopulatedAuthor(value: unknown): value is PopulatedAuthor {
  return typeof value === 'object' && value !== null && 'username' in value;
}

export function toMessageDto(doc: MessageDoc): MessageDto {
  const rawAuthor: unknown = doc.authorId;
  let authorId: string;
  let author: MessageAuthorDto | null = null;

  if (isPopulatedAuthor(rawAuthor)) {
    authorId = rawAuthor._id.toString();
    author = {
      id: authorId,
      username: rawAuthor.username,
      displayName: rawAuthor.displayName ?? null,
      avatarUrl: rawAuthor.avatarUrl ?? null,
    };
  } else {
    authorId = (rawAuthor as Types.ObjectId).toString();
  }

  return {
    id: doc._id.toString(),
    channelId: doc.channelId,
    authorId,
    author,
    content: doc.content,
    mentions: (doc.mentions ?? []).map((m) => m.toString()),
    reactions: (doc.reactions ?? []).map((r) => ({
      emoji: r.emoji,
      userIds: (r.userIds ?? []).map((id) => id.toString()),
    })),
    editedAt: doc.editedAt ? doc.editedAt.toISOString() : null,
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
