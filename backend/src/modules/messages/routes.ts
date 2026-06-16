import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { ok } from '../../lib/response.js';
import {
  addReactionBody,
  channelIdParam,
  messageIdParam,
  messagesQuery,
  reactionParams,
  sendMessageBody,
  updateMessageBody,
} from './schemas.js';
import * as service from './service.js';

export const messagesRouter = Router();

messagesRouter.post('/channels/:channelId/messages', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const { content, clientId } = sendMessageBody.parse(req.body);

    const msg = await service.sendMessage(channelId, req.userId!, content, clientId);
    res.json(ok(msg));
  } catch (err) {
    next(err);
  }
});

messagesRouter.get('/channels/:channelId/messages', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const query = messagesQuery.parse(req.query);

    const result = await service.getMessages(req.userId!, channelId, query);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

messagesRouter.patch('/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const { messageId } = messageIdParam.parse(req.params);
    const { content } = updateMessageBody.parse(req.body);

    const msg = await service.updateMessage(messageId, req.userId!, content);
    res.json(ok(msg));
  } catch (err) {
    next(err);
  }
});

messagesRouter.delete('/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const { messageId } = messageIdParam.parse(req.params);

    await service.deleteMessage(messageId, req.userId!);
    res.json(ok({ success: true }));
  } catch (err) {
    next(err);
  }
});

messagesRouter.post('/messages/:messageId/reactions', requireAuth, async (req, res, next) => {
  try {
    const { messageId } = messageIdParam.parse(req.params);
    const { emoji } = addReactionBody.parse(req.body);

    await service.addReaction(messageId, req.userId!, emoji);
    res.json(ok({ success: true }));
  } catch (err) {
    next(err);
  }
});

messagesRouter.delete(
  '/messages/:messageId/reactions/:emoji',
  requireAuth,
  async (req, res, next) => {
    try {
      const { messageId, emoji } = reactionParams.parse(req.params);

      await service.removeReaction(messageId, req.userId!, emoji);
      res.json(ok({ success: true }));
    } catch (err) {
      next(err);
    }
  },
);
