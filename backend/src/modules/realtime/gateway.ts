import type { Server as HttpServer } from 'node:http';
import { Server as IoServer } from 'socket.io';
import { parseCookie } from 'cookie';

import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { SESSION_COOKIE } from '../../lib/cookies.js';
import { verifySessionToken } from '../../lib/jwt.js';
import { voicePresence, type VoiceStateChange } from '../voice/presence-store.js';
import { Channel, Quiz, ServerMember, User, DmRoom } from '../../db/models/index.js';
import { quizAnalytics } from '../quiz/analytics-store.js';
import type { QuizAnalyticsSnapshot } from '../quiz/analytics.js';
import {
  voiceActivityEvents,
  type VoiceActivityChange,
} from '../voice-activity/service.js';
import { messageEvents } from '../messages/realtime-bridge.js';
import type { MessageDto } from '../messages/schemas.js';
import { serverUnreadEvents } from '../servers/realtime-bridge.js';
import { dmEvents } from '../dms/realtime-bridge.js';
import type { DmRoomDto } from '../dms/schemas.js';
import { notificationEvents } from '../notifications/realtime-bridge.js';
import type { NotificationDto } from '../notifications/schemas.js';
import { presence, type PresenceChange } from '../presence/presence-store.js';
import { friendIdsOf } from '../presence/service.js';
import {
  friendEvents,
  type FriendRemovedEvent,
  type FriendRequestIncomingEvent,
  type FriendRequestRespondedEvent,
} from '../friends/service.js';
import {
  listenTogetherStore,
  type ListenTogetherInviteResolvedEvent,
  type ListenTogetherInviteSentEvent,
  type ListenTogetherPlaybackEvent,
  type ListenTogetherSessionEndedEvent,
} from '../listen-together/sessionStore.js';
import {
  serverEventBus,
  type ServerEventCreatedEvent,
  type ServerEventUpdatedEvent,
  type ServerEventDeletedEvent,
  type ServerEventRsvpChangedEvent,
} from '../events/service.js';

interface SessionSocketData {
  userId?: string;
  username?: string;
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** True when the user is a member of the server. */
async function isServerMember(userId: string, serverId: string): Promise<boolean> {
  return (await ServerMember.findOne({ serverId, userId }).select('_id').lean()) !== null;
}

/** Resolves a channel id to its owning server id, or null if invalid/missing. */
async function channelServerId(channelId: string): Promise<string | null> {
  if (!OBJECT_ID_RE.test(channelId)) return null;
  const channel = await Channel.findById(channelId).select('serverId').lean();
  return channel ? channel.serverId.toString() : null;
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

export interface ServerUnreadChanged {
  serverId: string;
  channelId: string;
}

export interface ServerToClientEvents {
  'voice:state_changed': (change: VoiceStateChange) => void;
  'quiz:analytics_changed': (snapshot: QuizAnalyticsSnapshot) => void;
  'calendar:event_changed': (change: CalendarEventChanged) => void;
  /**
   * Voice-activity snapshot fan-out. `snapshot` is null on a stop event;
   * non-null on start / playback control / quiz pin / host transfer.
   *
   * Watch kinds (`youtube`, `screen-share`) carry `state` + `currentTimeMs`
   * + `lastTickAt` so viewers project their playhead against
   * `currentTimeMs + (now - new Date(lastTickAt))`. The other kinds use
   * realtime channels owned by their own subsystem (Hocuspocus for notes,
   * tldraw sync for whiteboard, the existing quiz analytics socket), so
   * the snapshot is mainly a "this channel is doing X" signal for them.
   */
  'voice:activity_changed': (change: VoiceActivityChange) => void;
  /** A new pending request just landed in the recipient's inbox. */
  'friend_request:incoming': (event: FriendRequestIncomingEvent) => void;
  /** The recipient accepted a request you sent — `newFriend` is non-null. */
  'friend_request:accepted': (event: FriendRequestRespondedEvent) => void;
  /** The recipient declined a request you sent. `newFriend` is null. */
  'friend_request:declined': (event: FriendRequestRespondedEvent) => void;
  /** The sender cancelled a request that was pending in your inbox. */
  'friend_request:cancelled': (event: FriendRequestRespondedEvent) => void;
  /** A friendship was unilaterally removed — invalidate your friends list. */
  'friend:removed': (event: FriendRemovedEvent) => void;
  /** A friend has invited you to listen together. */
  'listen_together:invite_received': (event: ListenTogetherInviteSentEvent) => void;
  /**
   * Resolution for an invite involving you — either the one you sent was
   * accepted/declined, or one you received expired. `session` is non-null
   * only on `outcome === 'accepted'`.
   */
  'listen_together:invite_resolved': (event: ListenTogetherInviteResolvedEvent) => void;
  /** The other participant left, was replaced, or disconnected. */
  'listen_together:session_ended': (event: ListenTogetherSessionEndedEvent) => void;
  /** Host playback command — play/pause/seek/track_changed. Viewers only. */
  'listen_together:playback': (event: ListenTogetherPlaybackEvent) => void;
  /** A new server event was created — update the events list. */
  'server_event:created': (event: ServerEventCreatedEvent) => void;
  /** A server event was edited — patch it in the list and detail caches. */
  'server_event:updated': (event: ServerEventUpdatedEvent) => void;
  /** A server event was deleted — remove it from the list cache. */
  'server_event:deleted': (event: ServerEventDeletedEvent) => void;
  /** RSVP counts changed on an event — update counts in list + detail caches. */
  'server_event:rsvp_changed': (event: ServerEventRsvpChangedEvent) => void;
  'server_unread:changed': (event: ServerUnreadChanged) => void;
  /** A friend's online/idle/offline status changed. Delivered only to that
   *  user's friends. */
  'presence:changed': (change: PresenceChange) => void;

  // Chat
  'dm_room:updated': (room: DmRoomDto) => void;
  'notification:created': (notification: NotificationDto) => void;
  'notification:updated': (notification: NotificationDto) => void;
  'message:created': (message: MessageDto) => void;
  'message:updated': (message: MessageDto) => void;
  'message:deleted': (data: { messageId: string }) => void;
  'message:reaction_added': (data: { messageId: string; emoji: string; userId: string }) => void;
  'message:reaction_removed': (data: { messageId: string; emoji: string; userId: string }) => void;
  'typing:update': (data: { channelId: string; userId: string; username: string; isTyping: boolean }) => void;
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
   * Voice-activity room subscribe. Any authed caller can subscribe — the
   * membership gate lands when the channels module ships, same shape as
   * the calendar subscribe above.
   */
  'voice:subscribe_activity': (channelId: string, ack: (ok: boolean) => void) => void;
  'voice:unsubscribe_activity': (channelId: string) => void;
  /** Subscribe to realtime event updates for a server's events page. */
  'server_events:subscribe': (serverId: string, ack: (ok: boolean) => void) => void;
  'server_events:unsubscribe': (serverId: string) => void;

  // Chat
  'channel:join': (channelId: string) => void;
  'channel:leave': (channelId: string) => void;
  'typing:start': (channelId: string, username: string) => void;
  'typing:stop': (channelId: string, username: string) => void;
  /** Client-driven idle refinement: true when the tab has been idle, false on
   *  activity resume. Connection itself already implies online. */
  'presence:heartbeat': (idle: boolean) => void;
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
      // Resolve the username once so typing broadcasts use the verified identity
      // instead of a client-supplied (spoofable) value.
      const user = await User.findById(claims.sub).select('username').lean();
      socket.data.username = user?.username ?? 'Someone';
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
    // Connection-derived presence: this socket counts toward the user being
    // online. The store emits an `online` change only on the first socket.
    presence.markOnline(userId);
    void (async () => {
      try {
        const memberships = await ServerMember.find({ userId }).select('serverId').lean();
        await Promise.all(
          memberships.map((membership) =>
            socket.join(`server:${membership.serverId.toString()}:unread`),
          ),
        );
      } catch (err) {
        logger.warn({ err, userId }, 'realtime: failed to join server unread rooms');
      }
    })();

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

    socket.on('voice:subscribe_activity', async (channelId, ack) => {
      if (typeof channelId !== 'string' || !UUID_RE.test(channelId)) {
        ack(false);
        return;
      }
      await socket.join(`channel:${channelId}:activity`);
      ack(true);
    });

    socket.on('voice:unsubscribe_activity', (channelId) => {
      if (typeof channelId !== 'string') return;
      void socket.leave(`channel:${channelId}:activity`);
    });

    socket.on('server_events:subscribe', async (serverId, ack) => {
      if (typeof serverId !== 'string' || !OBJECT_ID_RE.test(serverId)) {
        ack(false);
        return;
      }
      // Only members may subscribe — otherwise event details would leak to
      // anyone who knows/guesses a server id.
      if (!(await isServerMember(userId, serverId))) {
        ack(false);
        return;
      }
      await socket.join(`server:${serverId}:events`);
      ack(true);
    });

    socket.on('server_events:unsubscribe', (serverId) => {
      if (typeof serverId !== 'string') return;
      void socket.leave(`server:${serverId}:events`);
    });

    socket.on('channel:join', async (channelId) => {
      if (typeof channelId !== 'string') return;
      
      // 1. Check server channel membership
      const serverId = await channelServerId(channelId);
      if (serverId && (await isServerMember(userId, serverId))) {
        await socket.join(`channel:${channelId}:chat`);
        await socket.join(`server:${serverId}:unread`);
        return;
      }

      // 2. Check DM room membership
      if (OBJECT_ID_RE.test(channelId)) {
        const dmRoom = await DmRoom.findById(channelId).lean();
        if (dmRoom && (dmRoom.userAId.toString() === userId || dmRoom.userBId.toString() === userId)) {
          await socket.join(`channel:${channelId}:chat`);
          return;
        }
      }
    });

    socket.on('channel:leave', (channelId) => {
      if (typeof channelId !== 'string') return;
      void socket.leave(`channel:${channelId}:chat`);
    });

    // Typing uses the verified server-side username, and only fans out for a
    // channel the socket has actually joined (which already required membership).
    socket.on('typing:start', (channelId) => {
      if (typeof channelId !== 'string') return;
      const room = `channel:${channelId}:chat`;
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit('typing:update', {
        channelId,
        userId,
        username: socket.data.username ?? 'Someone',
        isTyping: true,
      });
    });

    socket.on('typing:stop', (channelId) => {
      if (typeof channelId !== 'string') return;
      const room = `channel:${channelId}:chat`;
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit('typing:update', {
        channelId,
        userId,
        username: socket.data.username ?? 'Someone',
        isTyping: false,
      });
    });

    socket.on('presence:heartbeat', (idle) => {
      if (typeof idle !== 'boolean') return;
      presence.setIdle(userId, idle);
    });

    socket.on('disconnect', (reason) => {
      logger.info({ userId, sid: socket.id, reason }, 'realtime: client disconnected');
      // This socket no longer counts toward presence; the store emits an
      // `offline` change only when it was the user's last live socket.
      presence.markOffline(userId);
      // Only tear down listen-together state when *all* of the user's
      // sockets are gone — same user with two tabs open shouldn't lose
      // their session because one tab closed. The socket emitting
      // `disconnect` has already left its rooms by the time this fires,
      // so a remaining room size of 0 means they were the last tab.
      const room = io?.sockets.adapter.rooms.get(`user:${userId}`);
      if (!room || room.size === 0) {
        listenTogetherStore.handleDisconnect(userId);
      }
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

  // Bridge the voice-activity service. Subscribers in
  // `channel:<id>:activity` get every state change for that channel.
  voiceActivityEvents.on('state_changed', (change: VoiceActivityChange) => {
    io?.to(`channel:${change.channelId}:activity`).emit('voice:activity_changed', change);
  });

  // Bridge the friends service. Every friend event carries a `toUserId` —
  // we deliver to that user's `user:<id>` room, which every socket of that
  // user joins on connection. No cross-user leakage by construction.
  friendEvents.on('request:incoming', (event: FriendRequestIncomingEvent) => {
    io?.to(`user:${event.toUserId}`).emit('friend_request:incoming', event);
  });
  friendEvents.on('request:accepted', (event: FriendRequestRespondedEvent) => {
    io?.to(`user:${event.toUserId}`).emit('friend_request:accepted', event);
  });
  friendEvents.on('request:declined', (event: FriendRequestRespondedEvent) => {
    io?.to(`user:${event.toUserId}`).emit('friend_request:declined', event);
  });
  friendEvents.on('request:cancelled', (event: FriendRequestRespondedEvent) => {
    io?.to(`user:${event.toUserId}`).emit('friend_request:cancelled', event);
  });
  friendEvents.on('removed', (event: FriendRemovedEvent) => {
    io?.to(`user:${event.toUserId}`).emit('friend:removed', event);
  });

  // Bridge the presence store. A user's status change is delivered only to
  // their friends' `user:<id>` rooms — presence never leaks to strangers.
  // We resolve friend edges per change; at v1 scale this is a cheap indexed
  // read, and it keeps the store free of any DB dependency.
  presence.on('state_changed', (change: PresenceChange) => {
    void (async () => {
      try {
        const friendIds = await friendIdsOf(change.userId);
        for (const friendId of friendIds) {
          io?.to(`user:${friendId}`).emit('presence:changed', change);
        }
      } catch (err) {
        logger.warn({ err, userId: change.userId }, 'realtime: presence fan-out failed');
      }
    })();
  });

  // Bridge the listen-together store. Every event carries a `toUserId`;
  // we deliver to that user's `user:<id>` room. No cross-user leakage.
  listenTogetherStore.on('invite:sent', (event: ListenTogetherInviteSentEvent) => {
    io?.to(`user:${event.toUserId}`).emit('listen_together:invite_received', event);
  });
  listenTogetherStore.on(
    'invite:resolved',
    (event: ListenTogetherInviteResolvedEvent) => {
      io?.to(`user:${event.toUserId}`).emit('listen_together:invite_resolved', event);
    },
  );
  listenTogetherStore.on(
    'session:ended',
    (event: ListenTogetherSessionEndedEvent) => {
      io?.to(`user:${event.toUserId}`).emit('listen_together:session_ended', event);
    },
  );
  listenTogetherStore.on(
    'session:playback',
    (event: ListenTogetherPlaybackEvent) => {
      io?.to(`user:${event.toUserId}`).emit('listen_together:playback', event);
    },
  );

  // Bridge the server events bus. All members of the server who have
  // subscribed via `server_events:subscribe` sit in `server:<id>:events`.
  serverEventBus.on('created', (event: ServerEventCreatedEvent) => {
    io?.to(`server:${event.serverId}:events`).emit('server_event:created', event);
  });
  serverEventBus.on('updated', (event: ServerEventUpdatedEvent) => {
    io?.to(`server:${event.serverId}:events`).emit('server_event:updated', event);
  });
  serverEventBus.on('deleted', (event: ServerEventDeletedEvent) => {
    io?.to(`server:${event.serverId}:events`).emit('server_event:deleted', event);
  });
  serverEventBus.on('rsvp_changed', (event: ServerEventRsvpChangedEvent) => {
    io?.to(`server:${event.serverId}:events`).emit('server_event:rsvp_changed', event);
  });

  // Bridge chat message events
  messageEvents.on('message:created', ({ channelId, message }) => {
    io?.to(`channel:${channelId}:chat`).emit('message:created', message);
  });
  messageEvents.on('message:updated', ({ channelId, message }) => {
    io?.to(`channel:${channelId}:chat`).emit('message:updated', message);
  });
  messageEvents.on('message:deleted', ({ channelId, messageId }) => {
    io?.to(`channel:${channelId}:chat`).emit('message:deleted', { messageId });
  });
  messageEvents.on('message:reaction_added', ({ channelId, messageId, emoji, userId }) => {
    io?.to(`channel:${channelId}:chat`).emit('message:reaction_added', { messageId, emoji, userId });
  });
  messageEvents.on('message:reaction_removed', ({ channelId, messageId, emoji, userId }) => {
    io?.to(`channel:${channelId}:chat`).emit('message:reaction_removed', { messageId, emoji, userId });
  });

  serverUnreadEvents.on('changed', ({ serverId, channelId }) => {
    io?.to(`server:${serverId}:unread`).emit('server_unread:changed', {
      serverId,
      channelId,
    });
  });

  dmEvents.on('room:updated', ({ toUserId, room }) => {
    io?.to(`user:${toUserId}`).emit('dm_room:updated', room);
  });

  notificationEvents.on('notification:created', ({ toUserId, notification }) => {
    io?.to(`user:${toUserId}`).emit('notification:created', notification);
  });
  notificationEvents.on('notification:updated', ({ toUserId, notification }) => {
    io?.to(`user:${toUserId}`).emit('notification:updated', notification);
  });

  logger.info('realtime: socket.io gateway started');
  return io;
}

export function getRealtimeServer(): WiscordIoServer | null {
  return io;
}

/**
 * True when the user has at least one live socket connected. Used by the
 * listen-together service to reject invites addressed to offline users —
 * by the time they'd sign back on, the inviter is likely on a different
 * track anyway. Pure read of the adapter; no allocations.
 */
export function isUserOnline(userId: string): boolean {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(`user:${userId}`);
  return room !== undefined && room.size > 0;
}
