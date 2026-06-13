import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DmSidebar } from './DmSidebar';
import { useRecentRoomsStore, type RecentRoom } from '@/lib/recent-rooms-store';

vi.mock('@/queries/dms', () => ({
  useDms: () => ({ data: [] }),
}));

vi.mock('@/queries/servers', () => ({
  useMyServers: () => ({
    data: [{ id: 's1', name: 'Server One', iconUrl: null, ownerId: 'u1', createdAt: '' }],
  }),
}));

// Stub the create-server modal — it pulls in query hooks irrelevant to this
// test (which only covers recent-rooms rendering).
vi.mock('@/components/server/CreateServerDialog', () => ({
  CreateServerDialog: () => null,
}));

function seed(rooms: RecentRoom[]): void {
  useRecentRoomsStore.setState({ recent: rooms });
}

function room(channelId: string, serverId: string): RecentRoom {
  return {
    serverId,
    channelId,
    serverName: `Server ${serverId}`,
    serverIconUrl: null,
    channelName: `chan-${channelId}`,
    channelType: 'text',
    visitedAt: Date.now(),
  };
}

function renderSidebar(): void {
  render(
    <MemoryRouter initialEntries={['/app']}>
      <DmSidebar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useRecentRoomsStore.setState({ recent: [] });
});

describe('DmSidebar — recent rooms', () => {
  it('renders recents for servers the user still belongs to', () => {
    seed([room('a', 's1')]);
    renderSidebar();
    expect(screen.getByText('chan-a')).toBeInTheDocument();
  });

  it('drops recents whose server the user has left (orphans)', () => {
    seed([room('a', 's1'), room('z', 's9')]);
    renderSidebar();
    expect(screen.getByText('chan-a')).toBeInTheDocument();
    expect(screen.queryByText('chan-z')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no recents', () => {
    renderSidebar();
    expect(screen.getByText(/No recent rooms yet/i)).toBeInTheDocument();
  });
});
