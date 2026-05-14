import type { RoomSnapshot } from '@tldraw/sync-core';

import { ChannelWhiteboard } from '../../db/models/index.js';
import { logger } from '../../lib/logger.js';

/**
 * Pure Mongo I/O for whiteboard snapshots. The room registry calls these
 * directly on debounced/heartbeat flushes; the HTTP service layer wraps
 * `loadWhiteboardSnapshot` for the cold-start REST endpoint.
 *
 * RoomSnapshot is tldraw's transport-shaped JSON of every shape + page +
 * binding currently in the room. We persist it verbatim — no schema
 * translation, no extracted "summary" — so a fresh client can reconstruct
 * the canvas without consulting the live room.
 */

export async function loadWhiteboardSnapshot(channelId: string): Promise<RoomSnapshot | null> {
  const row = await ChannelWhiteboard.findOne({ channelId });
  if (!row) return null;
  try {
    return JSON.parse(row.snapshot) as RoomSnapshot;
  } catch (err) {
    // Corrupt payload — start the room fresh instead of refusing to open.
    // The next flush overwrites the bad row.
    logger.warn({ err, channelId }, 'whiteboard: corrupt snapshot, starting empty');
    return null;
  }
}

export async function persistWhiteboardSnapshot(args: {
  channelId: string;
  snapshot: RoomSnapshot;
  lastEditorId: string;
}): Promise<void> {
  const serialized = JSON.stringify(args.snapshot);
  await ChannelWhiteboard.findOneAndUpdate(
    { channelId: args.channelId },
    { $set: { snapshot: serialized, lastEditorId: args.lastEditorId } },
    { upsert: true, new: true },
  );
}

export async function clearWhiteboardSnapshot(channelId: string): Promise<void> {
  await ChannelWhiteboard.deleteOne({ channelId });
}
