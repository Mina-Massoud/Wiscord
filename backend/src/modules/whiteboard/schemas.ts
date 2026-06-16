import { z } from 'zod';

import { channelIdSchema } from '../../lib/channel-id.js';

export const channelIdParam = z.object({
  channelId: channelIdSchema,
});
export type ChannelIdParam = z.infer<typeof channelIdParam>;

export const snapshotIdParam = channelIdParam.extend({
  snapshotId: z.string().regex(/^[a-f0-9]{24}$/i, 'snapshotId must be an ObjectId'),
});
export type SnapshotIdParam = z.infer<typeof snapshotIdParam>;

/**
 * Body for saving the current scratch as a history snapshot. Title is
 * optional — server auto-generates `Snapshot · <date>` when omitted, so
 * the float-button flow stays one click.
 */
export const saveSnapshotBody = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});
export type SaveSnapshotBody = z.infer<typeof saveSnapshotBody>;
