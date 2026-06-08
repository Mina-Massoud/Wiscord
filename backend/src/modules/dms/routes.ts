import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { ok } from '../../lib/response.js';
import { createDmRoomBody, dmRoomIdParam } from './schemas.js';
import * as service from './service.js';

export const dmsRouter = Router();

dmsRouter.use(requireAuth);

dmsRouter.post('/', async (req, res, next) => {
  try {
    const { recipientId } = createDmRoomBody.parse(req.body);
    const room = await service.getOrCreateDmRoom(req.userId!, recipientId);
    res.json(ok({ room }));
  } catch (err) {
    next(err);
  }
});

dmsRouter.get('/', async (req, res, next) => {
  try {
    const rooms = await service.listDmRooms(req.userId!);
    res.json(ok({ rooms }));
  } catch (err) {
    next(err);
  }
});

dmsRouter.get('/:dmRoomId', async (req, res, next) => {
  try {
    const { dmRoomId } = dmRoomIdParam.parse(req.params);
    const room = await service.getDmRoomDetail(req.userId!, dmRoomId);
    res.json(ok({ room }));
  } catch (err) {
    next(err);
  }
});

dmsRouter.post('/:dmRoomId/read', async (req, res, next) => {
  try {
    const { dmRoomId } = dmRoomIdParam.parse(req.params);
    await service.markDmRoomAsRead(req.userId!, dmRoomId);
    res.json(ok({ success: true }));
  } catch (err) {
    next(err);
  }
});
