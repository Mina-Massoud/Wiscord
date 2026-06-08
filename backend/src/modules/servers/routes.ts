import { Router } from 'express';

import { notFound } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  channelIdParam,
  createChannelBody,
  createServerBody,
  markChannelReadBody,
  serverIdParam,
  updateChannelBody,
  updateServerBody,
} from './schemas.js';
import {
  createChannel,
  createServer,
  deleteChannel,
  deleteServer,
  getServerForMember,
  getServersUnread,
  leaveServer,
  listChannelsForServer,
  listMembersForServer,
  listServersForUser,
  markChannelAsRead,
  updateChannel,
  updateServer,
} from './service.js';

export const serversRouter: Router = Router();

serversRouter.use(requireAuth);

/** GET /servers - servers the caller belongs to. */
serversRouter.get('/', async (req, res, next) => {
  try {
    const servers = await listServersForUser(req.userId!);
    res.json(ok({ servers }));
  } catch (err) {
    next(err);
  }
});

/** POST /servers - create a server with default text + voice channels. */
serversRouter.post('/', async (req, res, next) => {
  try {
    const body = createServerBody.parse(req.body);
    const result = await createServer(req.userId!, body);
    res.status(201).json(ok(result));
  } catch (err) {
    next(err);
  }
});

/** GET /servers/unread - unread status for all servers the user belongs to. */
serversRouter.get('/unread', async (req, res, next) => {
  try {
    const servers = await getServersUnread(req.userId!);
    res.json(ok({ servers }));
  } catch (err) {
    next(err);
  }
});

/** GET /servers/:serverId/channels - channels in a server the caller belongs to. */
serversRouter.get('/:serverId/channels', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const channels = await listChannelsForServer(req.userId!, serverId);
    res.json(ok({ channels }));
  } catch (err) {
    next(err);
  }
});

/** POST /servers/:serverId/channels - create a text or voice channel. */
serversRouter.post('/:serverId/channels', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const body = createChannelBody.parse(req.body);
    const channel = await createChannel(req.userId!, serverId, body);
    res.status(201).json(ok({ channel }));
  } catch (err) {
    next(err);
  }
});

/** GET /servers/:serverId/members - members in a server the caller belongs to. */
serversRouter.get('/:serverId/members', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const members = await listMembersForServer(req.userId!, serverId);
    res.json(ok({ members }));
  } catch (err) {
    next(err);
  }
});

/** GET /servers/:serverId - single server when the caller is a member. */
serversRouter.get('/:serverId', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const server = await getServerForMember(req.userId!, serverId);
    if (!server) {
      throw notFound('server');
    }
    res.json(ok({ server }));
  } catch (err) {
    next(err);
  }
});

/** PATCH /servers/:serverId - update name/icon. Owner only. */
serversRouter.patch('/:serverId', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const body = updateServerBody.parse(req.body);
    const server = await updateServer(req.userId!, serverId, body);
    res.json(ok({ server }));
  } catch (err) {
    next(err);
  }
});

/** PATCH /servers/:serverId/channels/:channelId - rename a channel. Owner only. */
serversRouter.patch('/:serverId/channels/:channelId', async (req, res, next) => {
  try {
    const { serverId, channelId } = channelIdParam.parse(req.params);
    const body = updateChannelBody.parse(req.body);
    const channel = await updateChannel(req.userId!, serverId, channelId, body);
    res.json(ok({ channel }));
  } catch (err) {
    next(err);
  }
});

/** DELETE /servers/:serverId/channels/:channelId - delete a channel. Owner only. */
serversRouter.delete('/:serverId/channels/:channelId', async (req, res, next) => {
  try {
    const { serverId, channelId } = channelIdParam.parse(req.params);
    await deleteChannel(req.userId!, serverId, channelId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/** DELETE /servers/:serverId - delete server (owner) or leave it (member). */
serversRouter.delete('/:serverId', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const { action } = req.query;
    if (action === 'leave') {
      await leaveServer(req.userId!, serverId);
    } else {
      await deleteServer(req.userId!, serverId);
    }
    res.json(ok({ deleted: true }));
  } catch (err) {
    next(err);
  }
});

/** POST /servers/:serverId/channels/:channelId/read - mark channel as read. */
serversRouter.post('/:serverId/channels/:channelId/read', async (req, res, next) => {
  try {
    const { serverId, channelId } = channelIdParam.parse(req.params);
    markChannelReadBody.parse(req.body);
    await markChannelAsRead(req.userId!, serverId, channelId);
    res.json(ok({ success: true }));
  } catch (err) {
    next(err);
  }
});
