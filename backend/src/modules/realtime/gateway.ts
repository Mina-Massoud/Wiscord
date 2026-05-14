import type { Server as HttpServer } from 'node:http';
import { Server as IoServer } from 'socket.io';
import { parseCookie } from 'cookie';

import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { SESSION_COOKIE } from '../../lib/cookies.js';
import { verifySessionToken } from '../../lib/jwt.js';
import { voicePresence, type VoiceStateChange } from '../voice/presence-store.js';
import { Quiz } from '../../db/models/index.js';
import { quizAnalytics } from '../quiz/analytics-store.js';
import type { QuizAnalyticsSnapshot } from '../quiz/analytics.js';
import { watchPartyEvents, type WatchPartyChange } from '../watchparty/service.js';

interface SessionSocketData {
  userId?: string;
}

/**
 * Events the server can emit to clients. Keep this list explicit — Socket.IO
 * statically enforces the payload type at every emit site, which catches
 * mismatches between the gateway and frontend listeners at compile time.
 */
export interface CalendarEventChanged {
  kind: 'created' | 'updated' | 'deleted';
  channelId: string | null;
  eventId: string;
}

export interface ServerToClientEvents {
  'voice:state_changed': (change: VoiceStateChange) => void;
  'quiz:analytics_changed': (snapshot: QuizAnalyticsSnapshot) => void;
  'calendar:event_changed': (change: CalendarEventChanged) => void;
  /**
   * Watch Together snapshot fan-out. `snapshot` is null on a stop event
   * (host ended the party); non-null on start / play / pause / seek /
   * transfer. Viewers project their playhead against
   * `snapshot.currentTimeMs + (now - new Date(snapshot.lastTickAt))`.
   */
  'watch:state_changed': (change: WatchPartyChange) => void;
}

interface ClientToServerEvents {
  /**
   * Host-only: subscribe to live analytics for a quiz. Server verifies the
   * caller owns the quiz, joins them to `quiz:<id>:host`, and pushes the
   * current snapshot back through the same event so the dashboard renders
   * immediately. Ack returns false when the quiz doesn't exist or the
   * caller isn't the host.
   */
  'quiz:subscribe_host': (quizId: string, ack: (ok: boolean) => void) => void;
  'quiz:unsubscribe_host': (quizId: string) => void;
  /**
   * Channel calendar subscribe. v1 trusts any authed caller to subscribe
   * (matches the existing channel-scoped routes); a real membership check
   * lands when the channels module ships.
   */
  'calendar:subscribe_channel': (channelId: string, ack: (ok: boolean) => void) => void;
  'calendar:unsubscribe_channel': (channelId: string) => void;
  /**
   * Watch Party room subscribe. Any authed caller can subscribe — the
   * membership gate lands when the channels module ships, same shape as
   * the calendar subscribe above.
   */
  'watch:subscribe_channel': (channelId: string, ack: (ok: boolean) => void) => void;
  'watch:unsubscribe_channel': (channelId: string) => void;
}

type WiscordIoServer = IoServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SessionSocketData
>;

let io: WiscordIoServer | null = null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One Socket.IO server per backend process. Wired up from `server.ts` after
 * the HTTP listener is created so it shares the same port and TLS termination
 * — clients dial `${API_URL}` and get upgraded.
 *
 * Auth is the existing session cookie (`wiscord_session`). We verify the JWT
 * up-front in `io.use()` and attach `socket.data.userId`. Anonymous sockets
 * are rejected before they ever join a room — there's no anonymous surface
 * here.
 *
 * Each socket auto-joins:
 *   - `user:<userId>` for direct messages to the user
 *
 * Voice presence is broadcast to *all* authenticated sockets (the
 * `authenticated` room). When servers/channels exist we'll switch to
 * `server:<serverId>` rooms so a user only gets events for servers they're
 * a member of.
 */
export function startRealtimeGateway(httpServer: HttpServer): WiscordIoServer {
  if (io) return io;

  io = new IoServer(httpServer, {
    path: '/realtime',
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie ?? '';
      const parsed = parseCookie(raw);
      const token = parsed[SESSION_COOKIE];
      if (!token) return next(new Error('unauthenticated'));
      const claims = await verifySessionToken(token);
      socket.data.userId = claims.sub;
      next();
    } catch (err) {
      logger.warn({ err }, 'realtime: handshake auth failed');
      next(new Error('unauthenticated'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    void socket.join(`user:${userId}`);
    void socket.join('authenticated');

    logger.info({ userId, sid: socket.id }, 'realtime: client connected');

    socket.on('quiz:subscribe_host', async (quizId, ack) => {
      try {
        if (typeof quizId !== 'string' || !/^[a-f0-9]{24}$/i.test(quizId)) {
          ack(false);
          return;
        }
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
          ack(false);
          return;
        }
        if (quiz.hostUserId !== userId) {
          logger.warn({ userId, quizId }, 'realtime: non-host tried to subscribe to quiz analytics');
          ack(false);
          return;
        }
        await socket.join(`quiz:${quizId}:host`);
        ack(true);
        // Push the initial snapshot so the dashboard renders without waiting
        // for the next mutation.
        const snapshot = await quizAnalytics.getOrCompute(quizId);
        if (snapshot) socket.emit('quiz:analytics_changed', snapshot);
      } catch (err) {
        logger.warn({ err, quizId }, 'realtime: quiz:subscribe_host failed');
        ack(false);
      }
    });

    socket.on('quiz:unsubscribe_host', (quizId) => {
      if (typeof quizId !== 'string') return;
      void socket.leave(`quiz:${quizId}:host`);
    });

    socket.on('calendar:subscribe_channel', async (channelId, ack) => {
      if (typeof channelId !== 'string' || !UUID_RE.test(channelId)) {
        ack(false);
        return;
      }
      await socket.join(`channel:${channelId}:calendar`);
      ack(true);
    });

    socket.on('calendar:unsubscribe_channel', (channelId) => {
      if (typeof channelId !== 'string') return;
      void socket.leave(`channel:${channelId}:calendar`);
    });

    socket.on('watch:subscribe_channel', async (channelId, ack) => {
      if (typeof channelId !== 'string' || !UUID_RE.test(channelId)) {
        ack(false);
        return;
      }
      await socket.join(`channel:${channelId}:watch`);
      ack(true);
    });

    socket.on('watch:unsubscribe_channel', (channelId) => {
      if (typeof channelId !== 'string') return;
      void socket.leave(`channel:${channelId}:watch`);
    });

    socket.on('disconnect', (reason) => {
      logger.info({ userId, sid: socket.id, reason }, 'realtime: client disconnected');
    });
  });

  // Bridge the presence store into Socket.IO. The store emits whenever the
  // poller or webhook receiver mutates a channel; we forward the full
  // participant list to every authenticated client.
  voicePresence.on('state_changed', (change: VoiceStateChange) => {
    io?.to('authenticated').emit('voice:state_changed', change);
  });

  // Bridge the quiz analytics store. Only sockets that subscribed via
  // `quiz:subscribe_host` (and passed the ownership check) sit in the
  // `quiz:<id>:host` room, so this never leaks data to non-hosts.
  quizAnalytics.on('analytics_changed', (snapshot: QuizAnalyticsSnapshot) => {
    io?.to(`quiz:${snapshot.quizId}:host`).emit('quiz:analytics_changed', snapshot);
  });

  // Bridge the Watch Together service. Subscribers in `channel:<id>:watch`
  // get every state change for that channel's party.
  watchPartyEvents.on('state_changed', (change: WatchPartyChange) => {
    io?.to(`channel:${change.channelId}:watch`).emit('watch:state_changed', change);
  });

  logger.info('realtime: socket.io gateway started');
  return io;
}

export function getRealtimeServer(): WiscordIoServer | null {
  return io;
}
