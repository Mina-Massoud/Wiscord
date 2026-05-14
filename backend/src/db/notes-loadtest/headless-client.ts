import { WebSocket as WSWebSocket } from 'ws';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

import { pickCursorColor } from './cursor-color.js';
import { appendParagraph } from './text-factory.js';

/**
 * One fake notes participant. Opens a Hocuspocus WebSocket to
 * `/sync/notes/:channelId`, completes the Yjs sync handshake, and on a
 * jittered loop appends ProseMirror-shaped paragraphs into the doc's
 * `default` XmlFragment so the host watching the real TipTap editor
 * sees new lines stream in.
 *
 * Awareness publishes the same `{ user: { id, name, color } }` payload
 * the browser provider emits, so the host also sees a fleet of named
 * cursors light up in the corner.
 *
 * Auth rides the same `wiscord_session` cookie the real frontend uses —
 * injected via a `ws`-backed WebSocket polyfill that pre-bakes the
 * Cookie + Origin headers on each connect.
 */

export interface HeadlessNotesClientOptions {
  wsUrl: string; // ws(s)://host/sync/notes/:channelId
  origin: string; // must match backend FRONTEND_ORIGIN
  sessionCookie: string; // "wiscord_session=<jwt>"
  channelId: string;
  userId: string;
  userName: string;
  /** Paragraphs appended per second per client. */
  rate: number;
  /** Awareness cursor pulses per second. */
  cursorHz: number;
  /** Total time to stay connected before clean-disconnect. */
  durationMs: number;
}

export interface HeadlessNotesClientResult {
  userId: string;
  userName: string;
  connected: boolean;
  paragraphsAppended: number;
  awarenessPulses: number;
  charsAppended: number;
  elapsedMs: number;
  errorMessage?: string;
}

/**
 * `HocuspocusProvider` defaults to the global `WebSocket`, which in
 * Node is the browser-shaped API and can't set custom headers. The `ws`
 * package supports headers via the options arg — we subclass it and
 * pre-bake the cookie + origin so every connect (and reconnect) ships
 * the auth the backend's upgrade gate is looking for.
 */
function buildCookieWebSocketPolyfill(
  cookie: string,
  origin: string,
): typeof WSWebSocket {
  return class CookieWebSocket extends WSWebSocket {
    constructor(address: string | URL, protocols?: string | string[]) {
      super(address as unknown as string, protocols, {
        headers: {
          Cookie: cookie,
          Origin: origin,
        },
      });
    }
  } as unknown as typeof WSWebSocket;
}

export async function runHeadlessNotesClient(
  opts: HeadlessNotesClientOptions,
): Promise<HeadlessNotesClientResult> {
  const startedAt = Date.now();
  const result: HeadlessNotesClientResult = {
    userId: opts.userId,
    userName: opts.userName,
    connected: false,
    paragraphsAppended: 0,
    awarenessPulses: 0,
    charsAppended: 0,
    elapsedMs: 0,
  };

  const cursorColor = pickCursorColor(opts.userId);
  const doc = new Y.Doc();
  let typeTimer: NodeJS.Timeout | null = null;
  let cursorTimer: NodeJS.Timeout | null = null;
  let stopTimer: NodeJS.Timeout | null = null;
  let provider: HocuspocusProvider | null = null;
  let resolved = false;

  return await new Promise<HeadlessNotesClientResult>((resolve) => {
    const finish = (errorMessage?: string): void => {
      if (resolved) return;
      resolved = true;
      if (typeTimer) clearInterval(typeTimer);
      if (cursorTimer) clearInterval(cursorTimer);
      if (stopTimer) clearTimeout(stopTimer);
      try {
        provider?.destroy();
      } catch {
        // already destroyed — nothing to do
      }
      try {
        doc.destroy();
      } catch {
        // already destroyed — nothing to do
      }
      result.elapsedMs = Date.now() - startedAt;
      if (errorMessage) result.errorMessage = errorMessage;
      resolve(result);
    };

    try {
      // Subtle: pass the polyfill at the *top level* of the
      // HocuspocusProvider config. `setConfiguration` forwards the
      // entire config object to a freshly-built `HocuspocusProviderWebsocket`,
      // which is where `WebSocketPolyfill` actually lives. Passing a
      // *pre-built* `websocketProvider` instead flips `manageSocket` to
      // false and the provider silently never wires up its `open` /
      // `status` / `message` listeners — auth never fires, paragraphs
      // never reach the server, and the host sits at "you're the only
      // one here" forever.
      provider = new HocuspocusProvider({
        url: opts.wsUrl,
        name: `channel:${opts.channelId}:notes`,
        document: doc,
        token: 'cookie',
        WebSocketPolyfill: buildCookieWebSocketPolyfill(opts.sessionCookie, opts.origin),
      } as unknown as ConstructorParameters<typeof HocuspocusProvider>[0]);
    } catch (err) {
      finish(err instanceof Error ? err.message : String(err));
      return;
    }

    const hp = provider;

    // Gate the typing loop on `authenticated` — fires *after* the Auth
    // handshake round-trips. Earlier raw `status === Connected` would
    // unleash pushes during the brief window before the server has
    // installed the document on the connection, and those pushes get
    // dropped instead of buffered.
    hp.on('authenticated', () => {
      if (!result.connected) {
        result.connected = true;
        hp.setAwarenessField('user', {
          id: opts.userId,
          name: opts.userName,
          color: cursorColor,
        });
        startTypingLoop();
      }
    });

    hp.on('authenticationFailed', ({ reason }: { reason: string }) => {
      finish(`auth failed: ${reason}`);
    });

    hp.on('close', ({ event }: { event: { code?: number; reason?: string } }) => {
      if (!result.connected) {
        finish(`closed before connect (${event.code ?? '?'}): ${event.reason ?? 'no reason'}`);
      }
    });

    function startTypingLoop(): void {
      // Seed one paragraph immediately so the host's editor pops on
      // first-connect — without this, the demo looks dead until the
      // first interval fires.
      pushParagraph();

      const typeInterval = Math.max(200, 1000 / Math.max(0.1, opts.rate));
      typeTimer = setInterval(pushParagraph, typeInterval);

      const cursorInterval = Math.max(100, 1000 / Math.max(0.1, opts.cursorHz));
      cursorTimer = setInterval(pulseAwareness, cursorInterval);

      stopTimer = setTimeout(() => finish(), opts.durationMs);
    }

    function pushParagraph(): void {
      if (!hp || !hp.isAuthenticated) return;
      try {
        const chars = appendParagraph(doc, opts.userName);
        result.paragraphsAppended += 1;
        result.charsAppended += chars;
      } catch (err) {
        finish(err instanceof Error ? err.message : String(err));
      }
    }

    function pulseAwareness(): void {
      if (!hp || !hp.isAuthenticated) return;
      // Re-publishing the same payload triggers an awareness update on
      // every other client — that's enough to keep our "Maya is editing"
      // pill live on the host without faking PM cursor selections.
      hp.setAwarenessField('user', {
        id: opts.userId,
        name: opts.userName,
        color: cursorColor,
        // monotonic counter so the awareness payload actually changes
        // each tick — otherwise Yjs's awareness layer dedupes the
        // identical state and skips the broadcast.
        tick: result.awarenessPulses,
      });
      result.awarenessPulses += 1;
    }
  });
}

