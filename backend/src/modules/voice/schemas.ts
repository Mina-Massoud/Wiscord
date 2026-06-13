import { z } from 'zod';

/** Channels are MongoDB ObjectIds (24 hex chars), not UUIDs. */
const channelId = z.string().regex(/^[a-f0-9]{24}$/i, 'channelId must be an ObjectId');

export const mintTokenBody = z.object({
  channelId,
});
export type MintTokenBody = z.infer<typeof mintTokenBody>;

export const channelIdParam = z.object({
  channelId,
});
export type ChannelIdParam = z.infer<typeof channelIdParam>;
