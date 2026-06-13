import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FriendsList } from './FriendsContentFriendsList';
import type { FriendDto, PresenceStatus } from '@/queries/client';

const friends: FriendDto[] = [
  { user: { id: 'u1', username: 'mina', displayName: 'Mina', avatarUrl: null }, friendedAt: '' },
  { user: { id: 'u2', username: 'sam', displayName: 'Sam', avatarUrl: null }, friendedAt: '' },
];

let presenceMap: Record<string, PresenceStatus> = {};

vi.mock('@/queries/friends', () => ({
  useFriends: () => ({ data: friends, isLoading: false, error: null }),
}));

vi.mock('@/queries/presence', () => ({
  usePresence: () => ({ data: presenceMap }),
}));

vi.mock('@/lib/copy/useCopy', () => ({
  useCopy: () => (key: string) => key,
}));

// Stub the row so this test stays focused on the list's filtering, not the
// row's own query dependencies (remove friend, start DM, …).
vi.mock('./FriendRow', () => ({
  FriendRow: ({ friend, status }: { friend: FriendDto; status?: PresenceStatus }) => (
    <div data-testid="friend-row">{`${friend.user.username}:${status ?? 'offline'}`}</div>
  ),
}));

function renderList(activeTab: 'online' | 'all'): void {
  render(<FriendsList activeTab={activeTab} onTabChange={() => {}} />);
}

describe('FriendsList — presence-gated Online tab', () => {
  it('Online tab shows only friends who are online or idle', () => {
    presenceMap = { u1: 'online', u2: 'offline' };
    renderList('online');
    expect(screen.getByText('mina:online')).toBeInTheDocument();
    expect(screen.queryByText(/^sam:/)).not.toBeInTheDocument();
  });

  it('All tab shows every friend with their live status', () => {
    presenceMap = { u1: 'idle', u2: 'offline' };
    renderList('all');
    expect(screen.getByText('mina:idle')).toBeInTheDocument();
    expect(screen.getByText('sam:offline')).toBeInTheDocument();
  });

  it('Online tab renders the empty state when nobody is online', () => {
    presenceMap = { u1: 'offline', u2: 'offline' };
    renderList('online');
    expect(screen.queryByTestId('friend-row')).not.toBeInTheDocument();
    // Empty-state copy key (mocked useCopy returns the key verbatim).
    expect(screen.getByText('friends.empty.online.title')).toBeInTheDocument();
  });
});
