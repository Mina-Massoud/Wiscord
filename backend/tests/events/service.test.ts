import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createEvent, listServerEvents } from '../../src/modules/events/service.js';

const mockServerMemberFindOne = vi.fn();
const mockServerEventCreate = vi.fn();
const mockServerEventFind = vi.fn();
const mockUserFindById = vi.fn();
const mockEventRsvpCount = vi.fn();
const mockEventRsvpFindOne = vi.fn();

vi.mock('../../src/db/models/index.js', () => ({
  ServerMember: {
    findOne: (...args: unknown[]) => mockServerMemberFindOne(...args),
  },
  ServerEvent: {
    create: (...args: unknown[]) => mockServerEventCreate(...args),
    find: (...args: unknown[]) => mockServerEventFind(...args),
  },
  User: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
  EventRsvp: {
    countDocuments: (...args: unknown[]) => mockEventRsvpCount(...args),
    findOne: (...args: unknown[]) => mockEventRsvpFindOne(...args),
  },
}));

vi.mock('../../src/lib/env.js', () => ({
  env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

describe('Server Events Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockServerMemberFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ serverId: 'server1', userId: 'user1', role: 'member' }),
    });

    mockUserFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'creator1', username: 'creator', displayName: 'Creator' }),
    });

    mockEventRsvpCount.mockResolvedValue(0);
    mockEventRsvpFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
  });

  test('creates a valid voice channel event', async () => {
    const mockDoc = {
      _id: 'event1',
      serverId: 'server1',
      creatorId: 'creator1',
      title: 'Study Night',
      description: 'Let us study',
      type: 'voice_channel',
      channelId: 'channel1',
      externalLink: null,
      startsAt: new Date('2026-06-01T10:00:00Z'),
      endsAt: new Date('2026-06-01T12:00:00Z'),
      coverColor: '#5865F2',
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockServerEventCreate.mockResolvedValue(mockDoc);

    const result = await createEvent('user1', 'server1', {
      title: 'Study Night',
      description: 'Let us study',
      type: 'voice_channel',
      channelId: 'channel1',
      startsAt: '2026-06-01T10:00:00Z',
      endsAt: '2026-06-01T12:00:00Z',
      coverColor: '#5865F2',
    });

    expect(result.id).toBe('event1');
    expect(result.title).toBe('Study Night');
    expect(result.channelId).toBe('channel1');
    expect(result.externalLink).toBeNull();
    expect(mockServerEventCreate).toHaveBeenCalled();
  });
});
