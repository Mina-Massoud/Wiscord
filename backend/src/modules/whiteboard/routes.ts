import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { channelIdParam } from './schemas.js';
import {
  clearWhiteboard,
  getWhiteboardSnapshot,
  listWhiteboardsForEditor,
} from './service.js';

export const whiteboardRouter: Router = Router();

/**
 * GET /whiteboard/mine
 * Lists every whiteboard the caller was the most recent editor on, newest
 * first. Backs the labs index page at `/app/labs/whiteboard`. Declared
 * before the dynamic `/:channelId/...` routes so the UUID zod check
 * doesn't claim `mine` first.
 */
whiteboardRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const boards = await listWhiteboardsForEditor({ userId: req.userId! });
    res.json(ok({ boards }));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /whiteboard/:channelId/snapshot
 * Returns: { snapshot: base64 | null, updatedAt: ISO | null, lastEditorId: string | null }
 *
 * Cold-start hydration for the canvas. The frontend reads this once on
 * page mount, applies it as the local store's initial state, then opens
 * the WebSocket to /sync/whiteboard/:channelId to take live deltas.
 */
whiteboardRouter.get(
  '/:channelId/snapshot',
  requireAuth,
  async (req, res, next) => {
    try {
      const { channelId } = channelIdParam.parse(req.params);
      const result = await getWhiteboardSnapshot(channelId);
      res.json(ok(result));
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /whiteboard/:channelId
 * Returns: { cleared: true }
 *
 * Drops the live room (forcing connected clients to reconnect into a
 * fresh empty doc) and removes the persisted snapshot. Auth-gated only
 * for v1 — TODO(channel-team): once the channels module exists, narrow
 * this to channel hosts.
 */
whiteboardRouter.delete('/:channelId', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const result = await clearWhiteboard({ channelId, userId: req.userId! });
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});
