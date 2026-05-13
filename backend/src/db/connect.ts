import mongoose from 'mongoose';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB. Awaited once on boot from server.ts before the HTTP
 * listener binds — we never want to accept requests before the DB is ready.
 *
 * Mongoose internally maintains a connection pool, retries on transient
 * failures, and emits events. We log the lifecycle so failures aren't silent.
 */
export async function connectDb(): Promise<typeof mongoose> {
  mongoose.connection.on('disconnected', () => {
    logger.warn('mongo: disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('mongo: reconnected');
  });
  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'mongo: connection error');
  });

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5_000,
  });

  logger.info(
    { host: mongoose.connection.host, db: mongoose.connection.name },
    'mongo: connected',
  );
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
