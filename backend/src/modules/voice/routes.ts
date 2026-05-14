import { Router, raw } from 'express';

import { ok } from '../../lib/response.js';
import { logger } from '../../lib/logger.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { channelIdParam, mintTokenBody } from './schemas.js';
import { mintLivekitToken } from './service.js';
import { handleLivekitWebhook } from './webhook.js';
import { voicePresence } from './presence-store.js';

export const voiceRouter: Router = Router();

/**
 * POST /voice/token
 * Body: { channelId: uuid }
 * Returns: { token, livekitUrl, identity, roomName }
 *
 * Mints a 1-hour LiveKit JWT for the authenticated user, scoped to the
 * voice room for `channelId`. The frontend hands the token + url to
 * <LiveKitRoom /> from @livekit/components-react.
 */
voiceRouter.post('/token', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = mintTokenBody.parse(req.body);
    const result = await mintLivekitToken({ userId: req.userId!, channelId });
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /voice/:channelId/participants
 * Returns: { participants: [{ identity, name, joinedAt }] }
 *
 * Server-side participant list, sourced from the in-memory presence store
 * (fed by the LiveKit poller and webhook receiver). Lets viewers see who's
 * in a channel without holding a LiveKit connection themselves. The
 * Socket.IO `voice:state_changed` event delivers live updates after this
 * initial snapshot.
 */
voiceRouter.get('/:channelId/participants', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const participants = voicePresence.list(channelId);
    res.json(ok({ participants }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /voice/webhook
 * Body: LiveKit webhook event (binary-friendly JSON with signed JWT auth).
 *
 * Authenticated by LiveKit's `Authorization` header (verified inside
 * `handleLivekitWebhook` via `WebhookReceiver`). We register it with a `raw`
 * body parser so the signature can be validated against the exact bytes
 * LiveKit signed — the global JSON parser would re-serialize and break the
 * verification.
 */
voiceRouter.post(
  '/webhook',
  raw({ type: '*/*', limit: '256kb' }),
  async (req, res, next) => {
    try {
      const body = req.body instanceof Buffer ? req.body.toString('utf8') : '';
      const authHeader = req.header('Authorization') ?? '';
      const event = await handleLivekitWebhook(body, authHeader);
      logger.debug({ event: event.event, room: event.room?.name }, 'voice: webhook handled');
      res.json(ok({ accepted: true }));
    } catch (err) {
      next(err);
    }
  },
);
