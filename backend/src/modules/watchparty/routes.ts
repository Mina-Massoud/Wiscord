import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  channelIdParam,
  controlBody,
  startPartyBody,
  transferHostBody,
} from './schemas.js';
import {
  applyControl,
  getParty,
  startParty,
  stopParty,
  transferHost,
} from './service.js';

export const watchPartyRouter: Router = Router();

/**
 * GET /watch/:channelId
 * Returns the current Watch Party snapshot, or null if none is active.
 */
watchPartyRouter.get('/:channelId', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const snapshot = await getParty(channelId);
    res.json(ok({ party: snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /watch/:channelId/start
 * Body: { source: { kind, url, title? } }
 * Caller becomes host. Overwrites any existing party in the channel.
 */
watchPartyRouter.post('/:channelId/start', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const { source } = startPartyBody.parse(req.body);
    const snapshot = await startParty({ channelId, userId: req.userId!, source });
    res.json(ok({ party: snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /watch/:channelId/stop
 * Host-only. Idempotent — returns `{ stopped: false }` if no party existed.
 */
watchPartyRouter.post('/:channelId/stop', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const stopped = await stopParty({ channelId, userId: req.userId! });
    res.json(ok({ stopped }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /watch/:channelId/control
 * Body: { action: 'play' | 'pause' | 'seek', timeMs }
 * Host-only. Returns the new snapshot; the realtime gateway broadcasts to
 * viewers in parallel.
 */
watchPartyRouter.post('/:channelId/control', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const command = controlBody.parse(req.body);
    const snapshot = await applyControl({ channelId, userId: req.userId!, command });
    res.json(ok({ party: snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /watch/:channelId/host
 * Body: { toUserId }
 * Current host transfers control to another participant.
 */
watchPartyRouter.post('/:channelId/host', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const { toUserId } = transferHostBody.parse(req.body);
    const snapshot = await transferHost({
      channelId,
      fromUserId: req.userId!,
      toUserId,
    });
    res.json(ok({ party: snapshot }));
  } catch (err) {
    next(err);
  }
});
