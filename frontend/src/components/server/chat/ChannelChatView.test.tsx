import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ChannelChatView } from './ChannelChatView';
import type { ChannelDto } from '@/queries/channels';
import type { MessageDto } from '@/types/message';

const mocks = vi.hoisted(() => ({
  markChannelRead: vi.fn(),
  messageStatus: 'success' as 'pending' | 'success' | 'error',
  socketOptions: undefined as undefined | { onMessageCreated?: (message: MessageDto) => void },
}));

vi.mock('@formkit/auto-animate/react', () => ({
  useAutoAnimate: () => [vi.fn()],
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { id: 'me' } }),
}));

vi.mock('@/hooks/useChannelSocket', () => ({
  useChannelSocket: (_channelId: string, options?: { onMessageCreated?: (message: MessageDto) => void }) => {
    mocks.socketOptions = options;
  },
}));

vi.mock('@/queries/channels', async () => {
  const actual = await vi.importActual<typeof import('@/queries/channels')>('@/queries/channels');
  return {
    ...actual,
    useMarkChannelRead: () => ({ mutate: mocks.markChannelRead }),
  };
});

vi.mock('@/queries/messages', () => ({
  useChannelMessages: () => ({
    data: { pages: [{ messages: [], hasMore: false }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    status: mocks.messageStatus,
  }),
  useSendMessage: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/queries/members', () => ({
  useServerMembers: () => ({ data: [] }),
}));

vi.mock('./ChannelChatComposer', () => ({
  ChannelChatComposer: () => <div data-testid="composer" />,
}));

const channel: ChannelDto = {
  id: 'channel-1',
  serverId: 'server-1',
  name: 'general',
  type: 'text',
  position: 0,
  createdAt: '2026-06-08T00:00:00.000Z',
  unreadCount: 4,
};

function message(authorId: string): MessageDto {
  return {
    id: `message-${authorId}`,
    channelId: channel.id,
    authorId,
    content: 'hello',
    mentions: [],
    reactions: [],
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    deletedAt: null,
    editedAt: null,
    author: {
      id: authorId,
      username: authorId,
      displayName: null,
      avatarUrl: null,
    },
  };
}

describe('ChannelChatView unread behavior', () => {
  beforeEach(() => {
    mocks.markChannelRead.mockClear();
    mocks.messageStatus = 'success';
    mocks.socketOptions = undefined;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('marks the channel read after messages load', () => {
    render(
      <MemoryRouter>
        <ChannelChatView channel={channel} />
      </MemoryRouter>,
    );

    expect(mocks.markChannelRead).toHaveBeenCalledWith({
      serverId: 'server-1',
      channelId: 'channel-1',
    });
  });

  it('does not mark the channel read before messages load', () => {
    mocks.messageStatus = 'pending';

    render(
      <MemoryRouter>
        <ChannelChatView channel={channel} />
      </MemoryRouter>,
    );

    expect(mocks.markChannelRead).not.toHaveBeenCalled();
  });

  it('does not mark live messages read while the tab is hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    render(
      <MemoryRouter>
        <ChannelChatView channel={channel} />
      </MemoryRouter>,
    );
    mocks.markChannelRead.mockClear();

    mocks.socketOptions?.onMessageCreated?.(message('other-user'));

    expect(mocks.markChannelRead).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('marks live messages from other users read while the channel is active', () => {
    render(
      <MemoryRouter>
        <ChannelChatView channel={channel} />
      </MemoryRouter>,
    );
    mocks.markChannelRead.mockClear();

    mocks.socketOptions?.onMessageCreated?.(message('other-user'));

    expect(mocks.markChannelRead).toHaveBeenCalledWith({
      serverId: 'server-1',
      channelId: 'channel-1',
    });
  });

  it('does not mark own live messages as unread work', () => {
    render(
      <MemoryRouter>
        <ChannelChatView channel={channel} />
      </MemoryRouter>,
    );
    mocks.markChannelRead.mockClear();

    mocks.socketOptions?.onMessageCreated?.(message('me'));

    expect(mocks.markChannelRead).not.toHaveBeenCalled();
  });
});
