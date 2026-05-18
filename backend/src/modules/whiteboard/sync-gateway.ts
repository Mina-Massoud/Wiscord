import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';

// Mirror `ws`'s `WebSocket.RawData` (declaration-merged with the type
// export above — namespace access from a type-only import doesn't
// resolve in this tsconfig).
type WsFrame = Buffer | ArrayBuffer | Buffer[];
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
// Permissive hex-only UUID shape — matches the realtime gateway and the
// voice token mint, both of which accept any UUID-shaped string. The
// previous strict version+variant pattern (`[1-5]...[89ab]`) was rejecting
// dev/test UUIDs like `11111111-1111-1111-1111-111111111111` that voice
// channels use today, which left tldraw spinning forever in its connecting
// state when whiteboard was opened against those channels.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // Buffer any frames that arrive while we're loading the room from Mongo.
  // The browser opens the WS, then tldraw immediately sends its `connect`
  // frame — if `getOrCreateRoom` is still awaiting Mongo (which is slow
  // on the first cold connection for a brand-new channelId), that frame
  // would arrive before TLSocketRoom attached a listener and get silently
  // dropped. The client then sits in `loading` forever waiting for the
  // handshake reply the server never had a chance to compute. A page
  // refresh "fixes" it only because Mongo is warm the second time so the
  // listener wins the race. Buffer + replay closes the window for good.
  const pending: WsFrame[] = [];
  const bufferMessage = (data: WsFrame): void => {
    pending.push(data);
  };
  ws.on('message', bufferMessage);
  // Also fail loudly if the socket dies before we hand it off — otherwise
  // a dead ws would silently feed empty replays into TLSocketRoom.
  let closedDuringLoad = false;
  const markClosed = (): void => {
    closedDuringLoad = true;
  };
  ws.once('close', markClosed);

  try {
    const room = await getOrCreateRoom(channelId);
    markRoomEditor(channelId, userId);

    if (closedDuringLoad) {
      logger.info({ channelId, userId }, 'whiteboard: client left before handshake');
      return;
    }

    ws.off('message', bufferMessage);
    ws.off('close', markClosed);

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

    // Replay buffered frames now that tldraw's listener is attached.
    // Re-emitting on the same EventEmitter dispatches them to every
    // listener — including the one TLSocketRoom just installed.
    for (const data of pending) {
      ws.emit('message', data);
    }

    logger.info(
      { channelId, userId, replayed: pending.length },
      'whiteboard: client connected',
    );
  } catch (err) {
    ws.off('message', bufferMessage);
    ws.off('close', markClosed);
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
