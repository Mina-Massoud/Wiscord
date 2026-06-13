import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { SuggestedRoomsList } from './SuggestedRoomsList';
import type { DiscoverServerDto } from '@/queries/servers';

type DiscoverState = {
  data?: DiscoverServerDto[];
  isLoading: boolean;
  isError: boolean;
};

let state: DiscoverState = { isLoading: false, isError: false };

vi.mock('@/queries/servers', () => ({
  useDiscoverServers: () => state,
}));

function renderList(): void {
  render(
    <MemoryRouter>
      <SuggestedRoomsList />
    </MemoryRouter>,
  );
}

describe('SuggestedRoomsList', () => {
  it('shows skeletons while loading', () => {
    state = { isLoading: true, isError: false };
    renderList();
    expect(screen.getByText('Suggested rooms')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders public servers with member counts and a join link', () => {
    state = {
      isLoading: false,
      isError: false,
      data: [
        {
          id: 's1',
          name: 'Open Study Hall',
          iconUrl: null,
          memberCount: 12,
          firstChannelId: 'c1',
          blurb: null,
        },
      ],
    };
    renderList();
    expect(screen.getByText('Open Study Hall')).toBeInTheDocument();
    expect(screen.getByText('12 members')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/servers/s1/channels/c1');
  });

  it('omits the section when there are no public servers', () => {
    state = { isLoading: false, isError: false, data: [] };
    renderList();
    expect(screen.queryByText('Suggested rooms')).not.toBeInTheDocument();
  });

  it('omits the section on error (secondary rail stays quiet)', () => {
    state = { isLoading: false, isError: true };
    renderList();
    expect(screen.queryByText('Suggested rooms')).not.toBeInTheDocument();
  });
});
