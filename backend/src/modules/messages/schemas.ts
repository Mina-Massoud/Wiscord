import { z } from 'zod';

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
