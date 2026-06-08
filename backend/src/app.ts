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
import { aiRouter } from './modules/ai/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { voiceRouter } from './modules/voice/routes.js';
import { quizRouter } from './modules/quiz/routes.js';
import { whiteboardRouter } from './modules/whiteboard/routes.js';
import { notesRouter } from './modules/notes/routes.js';
import { calendarRouter } from './modules/calendar/routes.js';
import { storageRouter } from './modules/storage/routes.js';
import { voiceActivityRouter } from './modules/voice-activity/routes.js';
import { friendsRouter } from './modules/friends/routes.js';
import { privacyRouter } from './modules/privacy/routes.js';
import { securityRouter } from './modules/security/routes.js';
import { billingRouter } from './modules/billing/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import { stripeWebhookBodyParser, stripeWebhookHandler } from './modules/billing/webhook.js';
import { integrationsRouter } from './modules/integrations/routes.js';
import { listenTogetherRouter } from './modules/listen-together/routes.js';
import { serversRouter } from './modules/servers/routes.js';
import { invitesRouter } from './modules/invites/routes.js';
import { eventsRouter } from './modules/events/routes.js';
import { messagesRouter } from './modules/messages/routes.js';
import { dmsRouter } from './modules/dms/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';

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
  // Stripe webhook must run BEFORE express.json() so signature verification
  // sees the raw byte buffer instead of a re-serialized JSON body.
  app.post('/billing/webhook', stripeWebhookBodyParser, stripeWebhookHandler);

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
  app.use('/servers', serversRouter);
  app.use('/invites', invitesRouter);
  app.use(eventsRouter);
  app.use('/ai', aiRouter);
  app.use('/voice', voiceRouter);
  app.use('/quiz', quizRouter);
  app.use('/whiteboard', whiteboardRouter);
  app.use('/notes', notesRouter);
  app.use('/calendar', calendarRouter);
  app.use('/storage', storageRouter);
  app.use('/channels', voiceActivityRouter);
  app.use('/friends', friendsRouter);
  app.use('/privacy', privacyRouter);
  app.use('/security', securityRouter);
  app.use('/billing', billingRouter);
  app.use('/integrations', integrationsRouter);
  app.use('/listen-together', listenTogetherRouter);
  app.use('/admin', adminRouter);
  app.use('/dms', dmsRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/', messagesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
