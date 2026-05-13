import { createApp } from './app.js';
import { connectDb, disconnectDb } from './db/connect.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';

// Block boot on DB readiness — we never want to serve before mongo is up.
await connectDb();

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'wiscord backend listening');
});

// Graceful shutdown — let in-flight requests finish, then quit.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutdown requested');
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
