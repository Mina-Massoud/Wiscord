import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { parse as parseCookie } from 'cookie';
import { nanoid } from 'nanoid';

import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { SESSION_COOKIE } from '../../lib/cookies.js';
import { verifySessionToken } from '../../lib/jwt.js';
import {
  getOrCreateRoom,
  markRoomEditor,
  shutdownRoomRegistry,
  flushAllRooms,
} from './room-registry.js';

/**
 * Raw WebSocket gateway for the tldraw collaboration protocol. Coexists
 * with the Socket.IO gateway on the same HTTP server — Node's EventEmitter
 * delivers `upgrade` to every listener, and each path-checks its prefix
 * before consuming the socket. We claim `/sync/whiteboard/:channelId`;
 * Socket.IO already owns `/realtime`. Anything else is left alone (the
 * `notFoundHandler` is HTTP-only and never sees upgrade requests).
 *
 * The upgrade is gated by:
 *   1. URL prefix + UUID-shaped channelId
 *   2. Origin must match FRONTEND_ORIGIN (no built-in CORS on raw WS)
 *   3. wiscord_session cookie verifies as a valid JWT
 *
 * Anonymous or cross-origin sockets get a clean 401/403/400 written to
 * the raw TCP stream and the socket is destroyed before the handshake
 * completes — they never reach TLSocketRoom.
 */

export interface WhiteboardSyncGateway {
  flushAll: () => Promise<void>;
  stop: () => Promise<void>;
}

const PATH_PREFIX = '/sync/whiteboard/';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let started: WhiteboardSyncGateway | null = null;

export function startWhiteboardSyncGateway(httpServer: HttpServer): WhiteboardSyncGateway {
  if (started) return started;

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    void handleUpgrade(req, socket, head, wss);
  });

  started = {
    flushAll: () => flushAllRooms(),
    stop: async () => {
      await shutdownRoomRegistry();
      wss.close();
    },
  };
  logger.info({ path: PATH_PREFIX }, 'whiteboard: sync gateway attached');
  return started;
}

async function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  wss: WebSocketServer,
): Promise<void> {
  const url = req.url ?? '';
  // Only handle our own paths. Bail silently otherwise so Socket.IO's
  // own upgrade listener can claim its sockets.
  if (!url.startsWith(PATH_PREFIX)) return;

  const channelId = url.slice(PATH_PREFIX.length).split('?')[0] ?? '';
  if (!UUID_RE.test(channelId)) {
    rejectSocket(socket, 400, 'invalid_channel_id');
    return;
  }

  const origin = req.headers.origin ?? '';
  if (origin !== env.FRONTEND_ORIGIN) {
    logger.warn({ origin, channelId }, 'whiteboard: rejected upgrade — bad origin');
    rejectSocket(socket, 403, 'forbidden_origin');
    return;
  }

  const cookies = parseCookie(req.headers.cookie ?? '');
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    rejectSocket(socket, 401, 'unauthenticated');
    return;
  }

  let userId: string;
  try {
    const claims = await verifySessionToken(token);
    userId = claims.sub;
  } catch (err) {
    logger.warn({ err, channelId }, 'whiteboard: rejected upgrade — bad session');
    rejectSocket(socket, 401, 'unauthenticated');
    return;
  }

  // TODO(channel-team): once the channels module ships, verify membership
  // here and 403 if userId is not a member of channelId. For now the only
  // gate is "signed-in" — anyone signed in can join any UUID's board.

  wss.handleUpgrade(req, socket, head, (ws) => {
    void attachClient(ws, channelId, userId);
  });
}

async function attachClient(
  ws: WebSocket,
  channelId: string,
  userId: string,
): Promise<void> {
  try {
    const room = await getOrCreateRoom(channelId);
    markRoomEditor(channelId, userId);
    // TLSocketRoom expects a `WebSocketMinimal`-shaped socket; `ws`'s
    // WebSocket implements the same `send`/`close`/`addEventListener`
    // surface but TS doesn't widen between them — single explicit cast.
    // userId is tracked via `markRoomEditor` (above) rather than the
    // optional `SessionMeta` generic; revisit if we ever need per-session
    // identity inside tldraw callbacks.
    type SocketArg = Parameters<typeof room.handleSocketConnect>[0];
    room.handleSocketConnect({
      sessionId: nanoid(),
      socket: ws as unknown as SocketArg['socket'],
    });
    logger.info({ channelId, userId }, 'whiteboard: client connected');
  } catch (err) {
    logger.error({ err, channelId, userId }, 'whiteboard: failed to attach client');
    ws.close(1011, 'internal error');
  }
}

function rejectSocket(socket: Duplex, status: number, reason: string): void {
  const statusText = httpStatusText(status);
  socket.write(
    `HTTP/1.1 ${status} ${statusText}\r\n` +
      `Connection: close\r\n` +
      `Content-Type: text/plain\r\n` +
      `Content-Length: ${Buffer.byteLength(reason)}\r\n` +
      `\r\n` +
      reason,
  );
  socket.destroy();
}

function httpStatusText(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    default:
      return 'Error';
  }
}
