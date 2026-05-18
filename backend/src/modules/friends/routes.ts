import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { friendIdParam, requestIdParam, searchQuery, sendRequestBody } from './schemas.js';
import {
  acceptRequest,
  cancelRequest,
  declineRequest,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  removeFriend,
  searchUsersByUsername,
  sendFriendRequest,
} from './service.js';

export const friendsRouter: Router = Router();

friendsRouter.use(requireAuth);

/** GET /friends — list current friends, newest edge first. */
friendsRouter.get('/', async (req, res, next) => {
  try {
    const friends = await listFriends(req.userId!);
    res.json(ok({ friends }));
  } catch (err) {
    next(err);
  }
});

/** DELETE /friends/:userId — unfriend. Idempotent; `removed: false` if not a friend. */
friendsRouter.delete('/:userId', async (req, res, next) => {
  try {
    const { userId } = friendIdParam.parse(req.params);
    const result = await removeFriend(req.userId!, userId);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

/** GET /friends/requests/incoming — pending requests addressed to me. */
friendsRouter.get('/requests/incoming', async (req, res, next) => {
  try {
    const requests = await listIncomingRequests(req.userId!);
    res.json(ok({ requests }));
  } catch (err) {
    next(err);
  }
});

/** GET /friends/requests/outgoing — pending requests I sent. */
friendsRouter.get('/requests/outgoing', async (req, res, next) => {
  try {
    const requests = await listOutgoingRequests(req.userId!);
    res.json(ok({ requests }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /friends/requests — send to a username.
 * Body: { username }
 * Auto-accepts if a reverse pending request already exists (race-safe path).
 */
friendsRouter.post('/requests', async (req, res, next) => {
  try {
    const { username } = sendRequestBody.parse(req.body);
    const request = await sendFriendRequest(req.userId!, username);
    res.json(ok({ request }));
  } catch (err) {
    next(err);
  }
});

/** POST /friends/requests/:id/accept — recipient accepts. */
friendsRouter.post('/requests/:id/accept', async (req, res, next) => {
  try {
    const { id } = requestIdParam.parse(req.params);
    const request = await acceptRequest(req.userId!, id);
    res.json(ok({ request }));
  } catch (err) {
    next(err);
  }
});

/** POST /friends/requests/:id/decline — recipient declines. */
friendsRouter.post('/requests/:id/decline', async (req, res, next) => {
  try {
    const { id } = requestIdParam.parse(req.params);
    const result = await declineRequest(req.userId!, id);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

/** DELETE /friends/requests/:id — sender cancels their own pending request. */
friendsRouter.delete('/requests/:id', async (req, res, next) => {
  try {
    const { id } = requestIdParam.parse(req.params);
    const result = await cancelRequest(req.userId!, id);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /friends/search?q=foo — username-prefix lookup for the "Add friend" tab.
 * Caps at 10, excludes the caller and existing friends. No presence / email
 * leak — only username, displayName, avatarUrl.
 */
friendsRouter.get('/search', async (req, res, next) => {
  try {
    const { q } = searchQuery.parse(req.query);
    const users = await searchUsersByUsername(req.userId!, q);
    res.json(ok({ users }));
  } catch (err) {
    next(err);
  }
});
