import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { channelIdParam } from './schemas.js';
import { clearNotes, listNotesForEditor } from './service.js';

export const notesRouter: Router = Router();

/**
 * GET /notes/mine
 * Lists every notes doc the caller was the most recent editor on, newest
 * first. Backs the labs index page at `/app/labs/notes`. Declared before
 * the dynamic `/:channelId` routes so the UUID zod check doesn't claim
 * `mine` first.
 */
notesRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const docs = await listNotesForEditor({ userId: req.userId! });
    res.json(ok({ docs }));
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /notes/:channelId
 * Returns: { cleared: true }
 *
 * Wipes the persisted Yjs doc for a channel. Connected clients will see
 * an empty doc on their next Hocuspocus reconnect. Auth-gated only for
 * v1 — TODO(channel-team): narrow to channel hosts when channels ships.
 */
notesRouter.delete('/:channelId', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const result = await clearNotes({ channelId, userId: req.userId! });
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});
