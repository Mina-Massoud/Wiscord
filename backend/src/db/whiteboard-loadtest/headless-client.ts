import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';

import { pickCursorColor } from './cursor-color.js';
import {
  makePresenceRecord,
  makeRandomShape,
  randomCursorPoint,
} from './shape-factory.js';

/**
 * One fake whiteboard participant. Opens a raw WebSocket to
 * `/sync/whiteboard/:channelId`, completes the tldraw sync handshake,
 * and then on a jittered loop posts new shape records + cursor moves
 * straight at the server.
 *
 * No tldraw editor is instantiated here — we speak the protocol
 * directly, which keeps each client ~1 MB instead of ~50 MB. Records
 * are hand-rolled to match the v5 validators in `@tldraw/tlschema`
 * (see `shape-factory.ts`); the server rejects with `INVALID_RECORD`
 * if any field drifts, so this file pairs tightly with that one.
 */

export interface HeadlessClientOptions {
  wsUrl: string;            // ws(s)://host/sync/whiteboard/:channelId
  origin: string;           // must match backend FRONTEND_ORIGIN
  sessionCookie: string;    // "wiscord_session=<jwt>"
  userId: string;
  userName: string;
  shapesPerSecond: number;
  cursorHz: number;         // cursor presence updates per second
  durationMs: number;       // total time to stay connected
  serializedSchema: unknown; // result of createTLSchema().serialize()
}

export interface HeadlessClientResult {
  userId: string;
  userName: string;
  connected: boolean;
  shapesPushed: number;
  presenceUpdates: number;
  elapsedMs: number;
  errorMessage?: string;
}

const TLSYNC_PROTOCOL_VERSION = 8;

interface ConnectResponse {
  type: 'connect';
  connectRequestId: string;
  hydrationType: 'wipe_all' | 'wipe_presence';
  protocolVersion: number;
  serverClock: number;
}

interface IncompatibilityResponse {
  type: 'incompatibility_error';
  reason: string;
}

interface ErrorResponse {
  type: 'error';
  fatalReason?: string;
}

type ServerMessage =
  | ConnectResponse
  | IncompatibilityResponse
  | ErrorResponse
  | { type: 'pong' }
  | { type: 'patch'; [key: string]: unknown }
  | { type: 'data'; [key: string]: unknown }
  | { type: string; [key: string]: unknown };

export async function runHeadlessClient(
  opts: HeadlessClientOptions,
): Promise<HeadlessClientResult> {
  const startedAt = Date.now();
  const result: HeadlessClientResult = {
    userId: opts.userId,
    userName: opts.userName,
    connected: false,
    shapesPushed: 0,
    presenceUpdates: 0,
    elapsedMs: 0,
  };

  let ws: WebSocket | null = null;
  let shapeTimer: NodeJS.Timeout | null = null;
  let cursorTimer: NodeJS.Timeout | null = null;
  let stopTimer: NodeJS.Timeout | null = null;

  const cleanup = (): void => {
    if (shapeTimer) clearInterval(shapeTimer);
    if (cursorTimer) clearInterval(cursorTimer);
    if (stopTimer) clearTimeout(stopTimer);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.close(1000, 'loadtest done');
      } catch {
        // socket already closing — nothing to do
      }
    }
  };

  return await new Promise<HeadlessClientResult>((resolve) => {
    let clientClock = 0;
    let connected = false;
    let resolved = false;
    const cursorColor = pickCursorColor(opts.userId);
    const connectRequestId = nanoid();

    const finish = (errorMessage?: string): void => {
      if (resolved) return;
      resolved = true;
      cleanup();
      result.connected = connected;
      result.elapsedMs = Date.now() - startedAt;
      if (errorMessage) result.errorMessage = errorMessage;
      resolve(result);
    };

    try {
      // The url comes in pre-formed (e.g. ws://localhost:3001/sync/whiteboard/:id).
      // Tack `sessionId` + `storeId` onto the query so the server can
      // demultiplex sessions — mirrors what `useSync` does on the browser.
      const url = new URL(opts.wsUrl);
      url.searchParams.set('sessionId', `loadtest-${opts.userId}-${nanoid(6)}`);
      url.searchParams.set('storeId', `loadtest-store-${opts.userId}`);

      ws = new WebSocket(url.toString(), {
        headers: {
          Cookie: opts.sessionCookie,
          Origin: opts.origin,
        },
      });
    } catch (err) {
      finish(err instanceof Error ? err.message : String(err));
      return;
    }

    const socket = ws;

    socket.on('error', (err: Error) => {
      finish(`ws error: ${err.message}`);
    });

    socket.on('unexpected-response', (_req, res) => {
      finish(`upgrade rejected: HTTP ${res.statusCode}`);
    });

    socket.on('close', (code, reason) => {
      // 1000 is a clean close — anything else means the server kicked us.
      if (!connected) {
        finish(`closed before connect (${code}): ${reason.toString() || 'no reason'}`);
        return;
      }
      finish();
    });

    socket.on('open', () => {
      const connectMessage = {
        type: 'connect',
        connectRequestId,
        lastServerClock: 0,
        protocolVersion: TLSYNC_PROTOCOL_VERSION,
        schema: opts.serializedSchema,
      };
      try {
        socket.send(JSON.stringify(connectMessage));
      } catch (err) {
        finish(err instanceof Error ? err.message : String(err));
      }
    });

    socket.on('message', (rawData) => {
      let payload: ServerMessage | ServerMessage[] | null = null;
      try {
        const text = typeof rawData === 'string' ? rawData : rawData.toString('utf8');
        payload = JSON.parse(text);
      } catch {
        // tldraw sometimes chunk-prefixes messages; the load-test
        // only cares about its own connect ack + error frames, both
        // of which are sent unchunked. Anything else is ignored.
        return;
      }

      const messages = Array.isArray(payload) ? payload : [payload];

      for (const msg of messages) {
        if (!msg || typeof msg !== 'object') continue;

        if (msg.type === 'incompatibility_error') {
          finish(`server rejected schema: ${(msg as IncompatibilityResponse).reason}`);
          return;
        }
        if (msg.type === 'error') {
          finish(`server error: ${(msg as ErrorResponse).fatalReason ?? 'unknown'}`);
          return;
        }
        if (msg.type === 'connect' && !connected) {
          connected = true;
          startDrawingLoop();
        }
      }
    });

    function startDrawingLoop(): void {
      // Push a first presence record so the host's canvas paints our
      // cursor pill immediately — without this, the cursor only shows
      // up once the first shape lands ~500 ms later.
      pushPresence();

      const shapeIntervalMs = Math.max(50, 1000 / Math.max(0.1, opts.shapesPerSecond));
      shapeTimer = setInterval(pushShape, shapeIntervalMs);

      const cursorIntervalMs = Math.max(50, 1000 / Math.max(0.1, opts.cursorHz));
      cursorTimer = setInterval(pushPresence, cursorIntervalMs);

      stopTimer = setTimeout(() => finish(), opts.durationMs);
    }

    function pushShape(): void {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const shape = makeRandomShape();
      const cursor = randomCursorPoint();
      const presence = makePresenceRecord({
        userId: opts.userId,
        userName: opts.userName,
        color: cursorColor,
        cursorX: cursor.x,
        cursorY: cursor.y,
      });
      const msg = {
        type: 'push',
        clientClock: clientClock++,
        diff: { [shape.id]: ['put', shape] },
        presence: ['put', presence],
      };
      try {
        socket.send(JSON.stringify(msg));
        result.shapesPushed += 1;
      } catch (err) {
        finish(err instanceof Error ? err.message : String(err));
      }
    }

    function pushPresence(): void {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const cursor = randomCursorPoint();
      const presence = makePresenceRecord({
        userId: opts.userId,
        userName: opts.userName,
        color: cursorColor,
        cursorX: cursor.x,
        cursorY: cursor.y,
      });
      const msg = {
        type: 'push',
        clientClock: clientClock++,
        presence: ['put', presence],
      };
      try {
        socket.send(JSON.stringify(msg));
        result.presenceUpdates += 1;
      } catch (err) {
        finish(err instanceof Error ? err.message : String(err));
      }
    }
  });
}
