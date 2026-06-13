import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { errorHandler } from '../../src/middleware/errorHandler.js';

vi.mock('../../src/lib/env.js', () => ({
  env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

vi.mock('../../src/middleware/requireAuth.js', () => ({
  requireAuth: (req: { userId: string }, _res: unknown, next: () => void) => {
    req.userId = '507f1f77bcf86cd799439011';
    next();
  },
}));

const mockGetServersUnread = vi.fn();
const mockGetServerForMember = vi.fn();
const mockListServersForUser = vi.fn();
const mockListPublicServers = vi.fn();

vi.mock('../../src/modules/servers/service.js', () => ({
  createChannel: vi.fn(),
  createServer: vi.fn(),
  deleteChannel: vi.fn(),
  deleteServer: vi.fn(),
  getServerForMember: (...args: unknown[]) => mockGetServerForMember(...args),
  getServersUnread: (...args: unknown[]) => mockGetServersUnread(...args),
  leaveServer: vi.fn(),
  listChannelsForServer: vi.fn(),
  listMembersForServer: vi.fn(),
  listPublicServers: (...args: unknown[]) => mockListPublicServers(...args),
  listServersForUser: (...args: unknown[]) => mockListServersForUser(...args),
  markChannelAsRead: vi.fn(),
  updateChannel: vi.fn(),
  updateServer: vi.fn(),
}));

let app: Express;

beforeEach(async () => {
  mockGetServersUnread.mockReset();
  mockGetServerForMember.mockReset();
  mockListServersForUser.mockReset();
  mockListPublicServers.mockReset();

  const { serversRouter } = await import('../../src/modules/servers/routes.js');
  app = express();
  app.use(express.json());
  app.use('/servers', serversRouter);
  app.use(errorHandler);
});

afterEach(() => {
  vi.resetModules();
});

describe('GET /servers/unread', () => {
  test('is handled before /servers/:serverId', async () => {
    mockGetServersUnread.mockResolvedValue([
      { serverId: '507f1f77bcf86cd799439012', hasUnread: true, unreadCount: 2 },
    ]);
    mockGetServerForMember.mockResolvedValue(null);

    const res = await request(app).get('/servers/unread');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.servers).toHaveLength(1);
    expect(mockGetServersUnread).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(mockGetServerForMember).not.toHaveBeenCalled();
  });
});

describe('GET /servers/discover', () => {
  test('is handled before /servers/:serverId and returns public servers', async () => {
    mockListPublicServers.mockResolvedValue([
      {
        id: '507f1f77bcf86cd799439099',
        name: 'Open Study Hall',
        iconUrl: null,
        memberCount: 12,
        firstChannelId: '507f1f77bcf86cd7994390aa',
        blurb: null,
      },
    ]);
    mockGetServerForMember.mockResolvedValue(null);

    const res = await request(app).get('/servers/discover');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.servers).toHaveLength(1);
    expect(res.body.data.servers[0].name).toBe('Open Study Hall');
    expect(mockListPublicServers).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    // "discover" must not be parsed as a :serverId.
    expect(mockGetServerForMember).not.toHaveBeenCalled();
  });
});
