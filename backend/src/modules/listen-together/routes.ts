import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { isUserOnline } from '../realtime/gateway.js';
import {
  inviteIdParam,
  playbackBody,
  sendInviteBody,
  sessionIdParam,
} from './schemas.js';
import {
  acceptInvite,
  broadcastPlayback,
  declineInvite,
  endSession,
  sendInvite,
} from './service.js';

export const listenTogetherRouter: Router = Router();

listenTogetherRouter.use(requireAuth);

/**
 * POST /listen-together/invites
 * Body: { toUserId, track }
 * Sends a listen-together invite to a friend. Recipient must be online and
 * neither party may already be in a session.
 */
listenTogetherRouter.post('/invites', async (req, res, next) => {
  try {
    const { toUserId, track } = sendInviteBody.parse(req.body);
    const invite = await sendInvite(req.userId!, toUserId, track, isUserOnline);
    res.json(ok({ invite }));
  } catch (err) {
    next(err);
  }
});

/** POST /listen-together/invites/:id/accept — recipient accepts; opens a session. */
listenTogetherRouter.post('/invites/:id/accept', async (req, res, next) => {
  try {
    const { id } = inviteIdParam.parse(req.params);
    const session = acceptInvite(req.userId!, id);
    res.json(ok({ session }));
  } catch (err) {
    next(err);
  }
});

/** POST /listen-together/invites/:id/decline — recipient bounces the invite. */
listenTogetherRouter.post('/invites/:id/decline', async (req, res, next) => {
  try {
    const { id } = inviteIdParam.parse(req.params);
    const result = declineInvite(req.userId!, id);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

/** POST /listen-together/sessions/:id/end — either participant ends the session. */
listenTogetherRouter.post('/sessions/:id/end', async (req, res, next) => {
  try {
    const { id } = sessionIdParam.parse(req.params);
    const result = endSession(req.userId!, id);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /listen-together/sessions/:id/playback
 * Host-only. Broadcasts a play/pause/seek/track_changed event to the viewer.
 */
listenTogetherRouter.post('/sessions/:id/playback', async (req, res, next) => {
  try {
    const { id } = sessionIdParam.parse(req.params);
    const body = playbackBody.parse(req.body);
    const playback = broadcastPlayback(req.userId!, id, body);
    res.json(ok({ playback }));
  } catch (err) {
    next(err);
  }
});
