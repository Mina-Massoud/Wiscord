import { z } from 'zod';

export const mintTokenBody = z.object({
  channelId: z.string().uuid('channelId must be a UUID'),
});
export type MintTokenBody = z.infer<typeof mintTokenBody>;

export const channelIdParam = z.object({
  channelId: z.string().uuid('channelId must be a UUID'),
});
export type ChannelIdParam = z.infer<typeof channelIdParam>;
