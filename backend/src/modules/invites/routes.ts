import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { createInviteBody, inviteCodeParam, serverIdParam } from './schemas.js';
import {
  createInviteForServer,
  getDefaultInviteForServer,
  listInvitesForServer,
  redeemInvite,
} from './service.js';

export const invitesRouter: Router = Router();

invitesRouter.use(requireAuth);

/** POST /invites/:code/redeem — join a server via invite link. */
invitesRouter.post('/:code/redeem', async (req, res, next) => {
  try {
    const { code } = inviteCodeParam.parse(req.params);
    const result = await redeemInvite(req.userId!, code);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

/** GET /invites/servers/:serverId — default share link for the server. */
invitesRouter.get('/servers/:serverId', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const invite = await getDefaultInviteForServer(req.userId!, serverId);
    res.json(ok({ invite }));
  } catch (err) {
    next(err);
  }
});

/** GET /invites/servers/:serverId/all — all invites (default + per-person). */
invitesRouter.get('/servers/:serverId/all', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const invites = await listInvitesForServer(req.userId!, serverId);
    res.json(ok({ invites }));
  } catch (err) {
    next(err);
  }
});

/** POST /invites/servers/:serverId — create a new invite (optional single-use). */
invitesRouter.post('/servers/:serverId', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const body = createInviteBody.parse(req.body ?? {});
    const invite = await createInviteForServer(req.userId!, serverId, body);
    res.status(201).json(ok({ invite }));
  } catch (err) {
    next(err);
  }
});
