import { z } from 'zod';

export const channelIdParam = z.object({
  channelId: z.string().uuid('channelId must be a UUID'),
});
export type ChannelIdParam = z.infer<typeof channelIdParam>;

export const snapshotIdParam = channelIdParam.extend({
  snapshotId: z.string().regex(/^[a-f0-9]{24}$/i, 'snapshotId must be an ObjectId'),
});
export type SnapshotIdParam = z.infer<typeof snapshotIdParam>;

export const saveSnapshotBody = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});
export type SaveSnapshotBody = z.infer<typeof saveSnapshotBody>;
