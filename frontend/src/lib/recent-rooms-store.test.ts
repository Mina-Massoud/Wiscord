import { beforeEach, describe, expect, test } from 'vitest';

import { MAX_RECENT_ROOMS, useRecentRoomsStore, type RecentRoom } from './recent-rooms-store';

function visit(channelId: string, serverId = 's1'): Omit<RecentRoom, 'visitedAt'> {
  return {
    serverId,
    channelId,
    serverName: `Server ${serverId}`,
    serverIconUrl: null,
    channelName: `chan-${channelId}`,
    channelType: 'text',
  };
}

const { recordVisit } = useRecentRoomsStore.getState();

beforeEach(() => {
  useRecentRoomsStore.setState({ recent: [] });
  localStorage.clear();
});

describe('recent-rooms store', () => {
  test('records a visit at the front', () => {
    recordVisit(visit('a'));
    const { recent } = useRecentRoomsStore.getState();
    expect(recent).toHaveLength(1);
    expect(recent[0].channelId).toBe('a');
    expect(recent[0].visitedAt).toBeGreaterThan(0);
  });

  test('dedupes by channelId and moves the repeat visit to the front', () => {
    recordVisit(visit('a'));
    recordVisit(visit('b'));
    recordVisit(visit('a'));
    const ids = useRecentRoomsStore.getState().recent.map((r) => r.channelId);
    expect(ids).toEqual(['a', 'b']);
  });

  test('caps the list at MAX_RECENT_ROOMS, dropping the oldest', () => {
    for (let i = 0; i < MAX_RECENT_ROOMS + 5; i++) {
      recordVisit(visit(`c${i}`));
    }
    const { recent } = useRecentRoomsStore.getState();
    expect(recent).toHaveLength(MAX_RECENT_ROOMS);
    // Newest first; the very first few visits fell off the end.
    expect(recent[0].channelId).toBe(`c${MAX_RECENT_ROOMS + 4}`);
    expect(recent.some((r) => r.channelId === 'c0')).toBe(false);
  });

  test('persists to localStorage so it survives a reload', () => {
    recordVisit(visit('a'));
    const raw = localStorage.getItem('wiscord.recent-rooms');
    expect(raw).toBeTruthy();
    expect(raw).toContain('"channelId":"a"');
  });
});
