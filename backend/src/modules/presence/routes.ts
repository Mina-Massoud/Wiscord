import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { presenceQuery } from './schemas.js';
import { getPresenceFor } from './service.js';

export const presenceRouter: Router = Router();

presenceRouter.use(requireAuth);

/**
 * GET /presence?userIds=a,b,c — current presence for a set of users (typically
 * the caller's friends). Returns a `{ [userId]: 'online' | 'idle' | 'offline' }`
 * map; ids the store has never seen come back as `offline`.
 */
presenceRouter.get('/', async (req, res, next) => {
  try {
    const { userIds } = presenceQuery.parse(req.query);
    res.json(ok({ presence: getPresenceFor(userIds) }));
  } catch (err) {
    next(err);
  }
});
