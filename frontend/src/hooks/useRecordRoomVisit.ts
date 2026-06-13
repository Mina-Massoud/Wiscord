import { useEffect } from 'react';

import { useRecentRoomsStore, type RecentRoom } from '@/lib/recent-rooms-store';

export type RecordRoomVisitInput = Omit<RecentRoom, 'visitedAt'>;

/**
 * Records a channel visit into the persisted recent-rooms store whenever the
 * given room resolves. Pass `null` until the channel + server have loaded so
 * we only ever record a row we can fully render.
 *
 * This is one of the few legitimate `useEffect` uses (rule #1: syncing an
 * external — here, persisted — store from route state). Deps are the resolved
 * primitives so it re-records only when the visited room actually changes.
 */
export function useRecordRoomVisit(room: RecordRoomVisitInput | null): void {
  const recordVisit = useRecentRoomsStore((s) => s.recordVisit);

  const serverId = room?.serverId;
  const channelId = room?.channelId;
  const serverName = room?.serverName;
  const serverIconUrl = room?.serverIconUrl ?? null;
  const channelName = room?.channelName;
  const channelType = room?.channelType;

  useEffect(() => {
    if (!serverId || !channelId || !serverName || !channelName || !channelType) return;
    recordVisit({ serverId, channelId, serverName, serverIconUrl, channelName, channelType });
  }, [serverId, channelId, serverName, serverIconUrl, channelName, channelType, recordVisit]);
}
