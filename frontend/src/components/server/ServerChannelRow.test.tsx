import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ServerChannelRow } from './ServerChannelRow';
import type { ChannelDto } from '@/queries/channels';

vi.mock('./ChannelRowContextMenu', () => ({
  ChannelRowContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const channel: ChannelDto = {
  id: 'channel-1',
  serverId: 'server-1',
  name: 'general',
  type: 'text',
  position: 0,
  createdAt: '2026-06-08T00:00:00.000Z',
  unreadCount: 3,
};

function renderRow(initialPath: string): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/app/servers/:serverId/channels/:channelId"
          element={<ServerChannelRow channel={channel} serverId="server-1" isOwner={false} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ServerChannelRow', () => {
  it('shows the backend unread count for inactive channels', () => {
    renderRow('/app/servers/server-1/channels/other-channel');

    expect(screen.getByLabelText('3 unread')).toBeInTheDocument();
  });

  it('does not show stale unread state on the active channel', () => {
    renderRow('/app/servers/server-1/channels/channel-1');

    expect(screen.queryByLabelText('3 unread')).not.toBeInTheDocument();
  });
});
