import { createApp } from './app.js';
import { connectDb, disconnectDb } from './db/connect.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { startRealtimeGateway } from './modules/realtime/gateway.js';
import { livekitPresencePoller } from './modules/voice/livekit-presence-poller.js';
import { startWhiteboardSyncGateway } from './modules/whiteboard/sync-gateway.js';

// Block boot on DB readiness — we never want to serve before mongo is up.
await connectDb();

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'wiscord backend listening');
});

// Realtime + presence side-channel. The Socket.IO gateway shares the HTTP
// server's port so clients dial the same origin as the REST API. The poller
// keeps the in-memory presence store in sync with LiveKit and is a no-op
// when LiveKit credentials aren't configured.
startRealtimeGateway(server);
livekitPresencePoller.start();

// Raw-WebSocket gateway for the tldraw collaboration protocol. Coexists
// with Socket.IO on the same HTTP `upgrade` event by path-prefix matching.
const whiteboardGateway = startWhiteboardSyncGateway(server);

// Graceful shutdown — let in-flight requests finish, then quit.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutdown requested');
  livekitPresencePoller.stop();
  // Flush every dirty whiteboard room before we tear down the HTTP server
  // so users don't lose strokes that arrived in the last debounce window.
  void whiteboardGateway.stop().catch((err) => {
    logger.error({ err }, 'whiteboard: shutdown flush failed');
  });
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
    await disconnectDb();
    logger.info('shutdown complete');
    process.exit(0);
  });
  // Hard timeout — if something hangs, don't wait forever.
  setTimeout(() => {
    logger.warn('forced exit after 10s');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  process.exit(1);
});
