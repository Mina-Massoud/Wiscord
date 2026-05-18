import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { parse as parseCookie } from 'cookie';
import { Hocuspocus } from '@hocuspocus/server';
import * as Y from 'yjs';

import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { SESSION_COOKIE } from '../../lib/cookies.js';
import { verifySessionToken } from '../../lib/jwt.js';
import {
  claimNotesDocOnConnect,
  getNotesDocName,
  hydrateNotesDoc,
  parseChannelIdFromDocName,
  persistNotesDoc,
} from './notes-persistence.js';

/**
 * Hocuspocus-based collaborative notes gateway.
 *
 * Mounts on the same HTTP server as Express, Socket.IO, and the tldraw
 * raw-WS gateway. We claim WebSocket upgrades whose path starts with
 * `/sync/notes/` — the URL tail is the channelId, and Hocuspocus uses the
 * URL to derive the document name on its end.
 *
 * Auth gate:
 *   1. URL prefix + UUID-shaped channelId in the path
 *   2. Origin must match FRONTEND_ORIGIN (raw WS has no CORS)
 *   3. wiscord_session cookie verifies as a valid JWT
 *
 * Anonymous / cross-origin sockets get a clean HTTP error written to the
 * raw TCP stream and the socket destroyed — they never reach Hocuspocus.
 * We do this *before* the WS handshake (instead of relying on Hocuspocus
 * `onAuthenticate`) so unauthorized clients never see protocol details.
 *
 * Persistence:
 *   - onLoadDocument → applies the stored Y update into the live Y.Doc
 *   - onStoreDocument → encodes the Y.Doc and upserts ChannelNotes
 *   - Hocuspocus debounces store calls (debounce 2s, maxDebounce 10s) so
 *     a typing user produces ~1 write per 2s, not 1 per keystroke.
 */

export interface NotesSyncGateway {
  flushAll: () => void;
  stop: () => Promise<void>;
}

/**
 * Tracks live WebSocket connections per channel so the snapshot-loader
 * can boot every active client off a document when the persisted Yjs
 * update is replaced under their feet. Clients auto-reconnect via the
 * Hocuspocus provider and re-hydrate from the updated Mongo row.
 */
const activeSockets = new Map<string, Set<WebSocket>>();

function trackSocket(channelId: string, ws: WebSocket): void {
  let set = activeSockets.get(channelId);
  if (!set) {
    set = new Set();
    activeSockets.set(channelId, set);
  }
  set.add(ws);
  ws.once('close', () => {
    const current = activeSockets.get(channelId);
    if (!current) return;
    current.delete(ws);
    if (current.size === 0) activeSockets.delete(channelId);
  });
}

/**
 * Close every live notes WebSocket for `channelId`. Called by the
 * snapshot loader so every connected client reconnects and re-hydrates
 * from the freshly-written Mongo state. Idempotent — no error if there
 * are no live sockets.
 */
export function closeNotesDocument(channelId: string): void {
  const set = activeSockets.get(channelId);
  if (!set) return;
  for (const ws of Array.from(set)) {
    try {
      ws.close(1012, 'snapshot_load');
    } catch {
      // Ignore — close errors mean the socket is already dead.
    }
  }
  activeSockets.delete(channelId);
}

const PATH_PREFIX = '/sync/notes/';
// Permissive hex-only UUID shape — matches the realtime gateway and the
// voice token mint, both of which accept any UUID-shaped string. The
// previous strict version+variant pattern rejected dev/test UUIDs that
// voice channels use today (e.g. `11111111-1111-1111-1111-111111111111`),
// leaving the notes editor stuck in its initial loading state.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface NotesContext {
  userId: string;
  channelId: string;
}

let started: NotesSyncGateway | null = null;

export function startNotesSyncGateway(httpServer: HttpServer): NotesSyncGateway {
  if (started) return started;

  const hocuspocus = new Hocuspocus({
    name: 'wiscord-notes',
    quiet: true,
    // 2s debounce / 10s max — same cadence as the whiteboard flush so users
    // who never stop typing still get durable saves twice a minute.
    debounce: 2000,
    maxDebounce: 10_000,

    async onAuthenticate(data) {
      // Surfaced as the per-connection auth gate. The upgrade-time gate
      // below already rejected unauthenticated sockets — this hook reads
      // the upgrade-time context attached via `handleConnection`'s third
      // arg and returns it as the connection context so document hooks
      // can see the user.
      const ctx = data.context as Partial<NotesContext> | undefined;
      if (!ctx?.userId || !ctx.channelId) {
        throw new Error('unauthenticated');
      }
      // Pin the document name to the channelId from the verified cookie
      // path so a client can't ask for a different channel's doc by
      // editing the URL after the handshake.
      const expected = getNotesDocName(ctx.channelId);
      if (data.documentName !== expected) {
        logger.warn(
          { userId: ctx.userId, requested: data.documentName, expected },
          'notes: rejected — document name does not match upgrade channel',
        );
        throw new Error('forbidden_document');
      }
      return { userId: ctx.userId, channelId: ctx.channelId } satisfies NotesContext;
    },

    async onLoadDocument({ documentName, document }) {
      const channelId = parseChannelIdFromDocName(documentName);
      if (!channelId) {
        // Should never happen — the upgrade gate enforces the format —
        // but defend in depth.
        logger.error({ documentName }, 'notes: bad document name on load');
        return document;
      }
      const applied = await hydrateNotesDoc(channelId, document);
      logger.info({ channelId, applied }, 'notes: document loaded');
      return document;
    },

    async afterLoadDocument({ documentName, document, context }) {
      // Whiteboard rooms auto-flush on connect (tldraw injects presence
      // records into the synced store, which counts as a doc change).
      // Yjs awareness is a separate ephemeral channel, so an empty Y.Doc
      // never triggers `onStoreDocument` on its own — the doc would stay
      // out of `/notes/mine` until the user typed a character. Claim the
      // row here so a freshly-created note shows up in the labs index
      // the moment the user lands on it, matching the whiteboard UX.
      //
      // `$setOnInsert` semantics: existing rows are untouched, so simply
      // viewing someone else's doc never silently reassigns authorship.
      const channelId = parseChannelIdFromDocName(documentName);
      if (!channelId) return;
      const userId = (context as Partial<NotesContext> | undefined)?.userId;
      if (!userId) return;
      try {
        const { created } = await claimNotesDocOnConnect({
          channelId,
          userId,
          doc: document as unknown as Y.Doc,
        });
        if (created) {
          logger.info({ channelId, userId }, 'notes: doc claimed on first connect');
        }
      } catch (err) {
        // Non-fatal: a missing claim row only affects the labs index,
        // not the live editing experience. Log and move on.
        logger.warn({ err, channelId }, 'notes: claim-on-connect failed');
      }
    },

    async onStoreDocument({ documentName, document, lastContext }) {
      const channelId = parseChannelIdFromDocName(documentName);
      if (!channelId) {
        logger.error({ documentName }, 'notes: bad document name on store');
        return;
      }
      const updatedBy = (lastContext as Partial<NotesContext> | undefined)?.userId ?? null;
      try {
        await persistNotesDoc({ channelId, doc: document as unknown as Y.Doc, updatedBy });
        logger.debug({ channelId, updatedBy }, 'notes: document persisted');
      } catch (err) {
        // Don't swallow — Hocuspocus will surface this as a hook error
        // and the client gets a sync warning, which is the right signal.
        logger.error({ err, channelId }, 'notes: persist failed');
        throw err;
      }
    },
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', (ws: WebSocket, request: IncomingMessage, context: NotesContext) => {
    trackSocket(context.channelId, ws);
    // Hocuspocus 4 wants a Fetch-like Request shape — IncomingMessage's
    // `.url` and `.headers` map closely enough that the runtime uses them
    // directly (it only reads `.url` and treats `.headers` as a dictionary).
    const clientConnection = hocuspocus.handleConnection(
      ws as unknown as WebSocket,
      request as unknown as Request,
      context,
    );

    // Crucial: Hocuspocus 4's `ClientConnection` does NOT subscribe to the
    // WebSocket itself — the websocket adapter is expected to forward
    // every frame via `clientConnection.handleMessage(data)`. Skipping
    // this is silent: the WS stays open, but no messages reach Hocuspocus,
    // so the Auth handshake never fires, no Document is created, and
    // every client sees "you're the only one here". The official
    // crossws adapter does the same plumbing — we're just hand-rolling
    // it because we're on raw `ws` to share an HTTP server with Express.
    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const buf =
        Buffer.isBuffer(data)
          ? data
          : Array.isArray(data)
            ? Buffer.concat(data)
            : Buffer.from(data);
      clientConnection.handleMessage(
        new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
      );
    });

    // Reference the returned ClientConnection in error logging only —
    // Hocuspocus has its own ping-timeout that catches dead sockets via
    // the `check` interval, so the per-document teardown happens
    // automatically when `ws.readyState` flips to Closed.
    ws.on('error', (err) => {
      logger.warn({ err, channelId: context.channelId }, 'notes: ws error');
    });
    void clientConnection;
  });

  httpServer.on('upgrade', (req, socket, head) => {
    void handleUpgrade(req, socket, head, wss);
  });

  started = {
    flushAll: () => {
      hocuspocus.flushPendingStores();
    },
    stop: async () => {
      hocuspocus.flushPendingStores();
      // Drop any live connections so the HTTP server can close cleanly.
      hocuspocus.closeConnections();
      wss.close();
    },
  };

  logger.info({ path: PATH_PREFIX }, 'notes: sync gateway attached');
  return started;
}

async function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  wss: WebSocketServer,
): Promise<void> {
  const url = req.url ?? '';
  // Only handle our own paths. Other listeners (Socket.IO, whiteboard)
  // claim their own prefixes; anything unmatched is left to the next
  // listener or destroyed by the last unhandled fallthrough.
  if (!url.startsWith(PATH_PREFIX)) return;

  const channelId = url.slice(PATH_PREFIX.length).split('?')[0] ?? '';
  if (!UUID_RE.test(channelId)) {
    rejectSocket(socket, 400, 'invalid_channel_id');
    return;
  }

  const origin = req.headers.origin ?? '';
  if (origin !== env.FRONTEND_ORIGIN) {
    logger.warn({ origin, channelId }, 'notes: rejected upgrade — bad origin');
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
    logger.warn({ err, channelId }, 'notes: rejected upgrade — bad session');
    rejectSocket(socket, 401, 'unauthenticated');
    return;
  }

  // TODO(channel-team): once the channels module ships, verify membership
  // here and 403 if userId is not a member of channelId. For now the only
  // gate is "signed-in" — anyone signed in can join any UUID's notes doc.

  wss.handleUpgrade(req, socket, head, (ws) => {
    const context: NotesContext = { userId, channelId };
    wss.emit('connection', ws, req, context);
  });
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
