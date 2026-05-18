import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { channelIdParam, saveSnapshotBody, snapshotIdParam } from './schemas.js';
import {
  clearWhiteboard,
  getWhiteboardSnapshot,
  listWhiteboardsForEditor,
} from './service.js';
import {
  deleteWhiteboardSnapshot,
  listWhiteboardSnapshots,
  loadWhiteboardSnapshotIntoScratch,
  saveWhiteboardSnapshot,
} from './snapshot-service.js';

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

/**
 * POST /whiteboard/:channelId/snapshots
 * Body: { title?: string }
 * Save the current scratch state as a named history entry.
 */
whiteboardRouter.post('/:channelId/snapshots', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const body = saveSnapshotBody.parse(req.body ?? {});
    const snapshot = await saveWhiteboardSnapshot({
      channelId,
      userId: req.userId!,
      ...(body.title !== undefined ? { title: body.title } : {}),
    });
    res.json(ok({ snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /whiteboard/:channelId/snapshots
 * List of saved history snapshots, newest first.
 */
whiteboardRouter.get('/:channelId/snapshots', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const snapshots = await listWhiteboardSnapshots(channelId);
    res.json(ok({ snapshots }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /whiteboard/:channelId/snapshots/:snapshotId/load
 * Replace the current scratch with this snapshot. Connected tldraw
 * clients reconnect and hydrate from the new state.
 */
whiteboardRouter.post(
  '/:channelId/snapshots/:snapshotId/load',
  requireAuth,
  async (req, res, next) => {
    try {
      const { channelId, snapshotId } = snapshotIdParam.parse(req.params);
      const result = await loadWhiteboardSnapshotIntoScratch({
        channelId,
        snapshotId,
        userId: req.userId!,
      });
      res.json(ok(result));
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /whiteboard/:channelId/snapshots/:snapshotId
 * Remove a saved snapshot from history. Doesn't touch the scratch.
 */
whiteboardRouter.delete(
  '/:channelId/snapshots/:snapshotId',
  requireAuth,
  async (req, res, next) => {
    try {
      const { channelId, snapshotId } = snapshotIdParam.parse(req.params);
      const result = await deleteWhiteboardSnapshot({ channelId, snapshotId });
      res.json(ok(result));
    } catch (err) {
      next(err);
    }
  },
);
