import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * One row in the "Recent rooms" list — a channel the user recently opened.
 * Display fields are denormalized at visit time (we have the resolved channel
 * + server in hand on the channel route), so the sidebar renders without
 * fanning a per-server query out across every recent server. Names can drift
 * if a channel/server is later renamed; that self-heals on the next visit,
 * which is acceptable for a "recent" shortcut list.
 */
export interface RecentRoom {
  serverId: string;
  channelId: string;
  serverName: string;
  /** Custom server icon, or null to fall back to an identicon at render time. */
  serverIconUrl: string | null;
  channelName: string;
  channelType: 'text' | 'voice';
  /** Epoch ms of the most recent visit. */
  visitedAt: number;
}

/** Keep the list short — it's a shortcut rail, not a history log. */
export const MAX_RECENT_ROOMS = 12;

interface RecentRoomsState {
  /** Most-recent-first, deduped by channelId, capped at MAX_RECENT_ROOMS. */
  recent: RecentRoom[];
  recordVisit: (room: Omit<RecentRoom, 'visitedAt'>) => void;
}

export const useRecentRoomsStore = create<RecentRoomsState>()(
  persist(
    (set) => ({
      recent: [],
      recordVisit: (room) =>
        set((state) => {
          const withoutDupe = state.recent.filter((r) => r.channelId !== room.channelId);
          const next: RecentRoom = { ...room, visitedAt: Date.now() };
          return { recent: [next, ...withoutDupe].slice(0, MAX_RECENT_ROOMS) };
        }),
    }),
    { name: 'wiscord.recent-rooms' },
  ),
);

/**
 * The recent-rooms list, most-recent-first. Selects a single stable array
 * reference (only changes when `recordVisit` mutates), so no `useShallow`
 * is needed.
 */
export function useRecentRooms(): RecentRoom[] {
  return useRecentRoomsStore((s) => s.recent);
}
