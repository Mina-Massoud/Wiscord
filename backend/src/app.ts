import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { Router } from 'express';

import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { ok } from './lib/response.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/routes.js';
import { voiceRouter } from './modules/voice/routes.js';
import { quizRouter } from './modules/quiz/routes.js';
import { whiteboardRouter } from './modules/whiteboard/routes.js';

/**
 * Builds the Express app. Boot logic (port binding, Socket.IO attach) lives
 * in server.ts so tests can import this factory without starting a listener.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // Health probe — proves the boot path end-to-end.
  const health = Router();
  health.get('/health', (_req, res) => {
    res.json(
      ok({ status: 'ok', uptime: process.uptime(), env: env.NODE_ENV } as const),
    );
  });
  app.use(health);

  app.use('/auth', authRouter);
  app.use('/voice', voiceRouter);
  app.use('/quiz', quizRouter);
  app.use('/whiteboard', whiteboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
