import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler.js';

vi.mock('../../src/lib/env.js', () => ({
  env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

vi.mock('../../src/middleware/requireAuth.js', () => ({
  requireAuth: (req: { userId: string }, _res: unknown, next: () => void) => {
    req.userId = '507f1f77bcf86cd799439011'; // valid mock ObjectId format for req.userId
    next();
  },
}));

const mockCreateEvent = vi.fn();
const mockListServerEvents = vi.fn();

vi.mock('../../src/modules/events/service.js', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  listServerEvents: (...args: unknown[]) => mockListServerEvents(...args),
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  upsertRsvp: vi.fn(),
  removeRsvp: vi.fn(),
  serverEventBus: {
    emitCreated: vi.fn(),
    emitUpdated: vi.fn(),
    emitDeleted: vi.fn(),
    emitRsvpChanged: vi.fn(),
  },
}));

let app: Express;

beforeEach(async () => {
  mockCreateEvent.mockReset();
  mockListServerEvents.mockReset();

  const { eventsRouter } = await import('../../src/modules/events/routes.js');
  app = express();
  app.use(express.json());
  app.use(eventsRouter);
  app.use(errorHandler);
});

afterEach(() => {
  vi.resetModules();
});

describe('POST /servers/:serverId/events', () => {
  const serverId = '507f1f77bcf86cd799439012'; // Valid ObjectId
  const channelId = '507f1f77bcf86cd799439013'; // Valid ObjectId

  test('accepts a valid request to create an event', async () => {
    const mockEventResponse = {
      id: '507f1f77bcf86cd799439014',
      serverId,
      creatorId: '507f1f77bcf86cd799439011',
      title: 'Study Session',
      description: 'Let\'s review code.',
      type: 'voice_channel',
      channelId,
      externalLink: null,
      startsAt: '2026-06-01T10:00:00.000Z',
      endsAt: '2026-06-01T11:00:00.000Z',
      coverColor: '#5865F2',
      status: 'scheduled',
      createdAt: '2026-05-29T20:00:00.000Z',
      updatedAt: '2026-05-29T20:00:00.000Z',
      goingCount: 0,
      interestedCount: 0,
      myRsvp: null,
      creator: { id: '507f1f77bcf86cd799439011', displayName: 'Mock User', avatarUrl: null },
    };

    mockCreateEvent.mockResolvedValue(mockEventResponse);

    const res = await request(app)
      .post(`/servers/${serverId}/events`)
      .send({
        title: 'Study Session',
        description: 'Let\'s review code.',
        type: 'voice_channel',
        channelId,
        startsAt: '2026-06-01T10:00:00Z',
        endsAt: '2026-06-01T11:00:00Z',
        coverColor: '#5865F2',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.event.id).toBe('507f1f77bcf86cd799439014');
  });

  test('rejects request with missing title', async () => {
    const res = await request(app)
      .post(`/servers/${serverId}/events`)
      .send({
        type: 'voice_channel',
        channelId,
        startsAt: '2026-06-01T10:00:00Z',
      });

    expect(res.status).toBe(400); // Validation error
  });

  test('rejects voice event with missing channelId', async () => {
    const res = await request(app)
      .post(`/servers/${serverId}/events`)
      .send({
        title: 'Study',
        type: 'voice_channel',
        startsAt: '2026-06-01T10:00:00Z',
      });

    expect(res.status).toBe(400);
  });
});
