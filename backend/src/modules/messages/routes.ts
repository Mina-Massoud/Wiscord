import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { ok } from '../../lib/response.js';
import { badRequest } from '../../lib/errors.js';
import {
  channelIdParam,
  messageIdParam,
  messagesQuery,
  reactionParams,
  sendMessageBody,
  updateMessageBody,
} from './schemas.js';
import * as service from './service.js';

export const messagesRouter = Router();

messagesRouter.post('/channels/:channelId/messages', requireAuth, async (req, res) => {
  const { channelId } = channelIdParam.parse(req.params);
  const { content } = sendMessageBody.parse(req.body);

  const msg = await service.sendMessage(channelId, req.userId!, content);
  res.json(ok(msg));
});

messagesRouter.get('/channels/:channelId/messages', requireAuth, async (req, res) => {
  const { channelId } = channelIdParam.parse(req.params);
  const query = messagesQuery.parse(req.query);

  const result = await service.getMessages(channelId, query);
  res.json(ok(result));
});

messagesRouter.patch('/messages/:messageId', requireAuth, async (req, res) => {
  const { messageId } = messageIdParam.parse(req.params);
  const { content } = updateMessageBody.parse(req.body);

  const msg = await service.updateMessage(messageId, req.userId!, content);
  res.json(ok(msg));
});

messagesRouter.delete('/messages/:messageId', requireAuth, async (req, res) => {
  const { messageId } = messageIdParam.parse(req.params);

  await service.deleteMessage(messageId, req.userId!);
  res.json(ok({ success: true }));
});

messagesRouter.post('/messages/:messageId/reactions', requireAuth, async (req, res) => {
  const { messageId } = messageIdParam.parse(req.params);
  // Expect emoji in body
  const { emoji } = req.body;
  if (!emoji || typeof emoji !== 'string') {
    throw badRequest('invalid_input', 'emoji is required');
  }

  await service.addReaction(messageId, req.userId!, emoji);
  res.json(ok({ success: true }));
});

messagesRouter.delete('/messages/:messageId/reactions/:emoji', requireAuth, async (req, res) => {
  const { messageId, emoji } = reactionParams.parse(req.params);

  await service.removeReaction(messageId, req.userId!, emoji);
  res.json(ok({ success: true }));
});
