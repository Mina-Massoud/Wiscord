import { z } from 'zod';

export const sendMessageBody = z.object({
  content: z.string().min(1).max(4000),
});

export const updateMessageBody = z.object({
  content: z.string().min(1).max(4000),
});

export const messagesQuery = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const channelIdParam = z.object({
  channelId: z.string().min(1),
});

export const messageIdParam = z.object({
  messageId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid message ID'),
});

export const reactionParams = z.object({
  messageId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid message ID'),
  emoji: z.string().min(1),
});
