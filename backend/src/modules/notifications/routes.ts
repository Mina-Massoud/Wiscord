import { Router } from 'express';

import { requireAuth } from '../../middleware/requireAuth.js';
import { ok } from '../../lib/response.js';
import { notificationIdParam, notificationsQuery } from './schemas.js';
import { NotificationService } from './service.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const query = notificationsQuery.parse(req.query);
    const notifications = await NotificationService.getUserNotifications(req.userId!, query);
    res.json(ok({ notifications }));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/:notificationId/read', async (req, res, next) => {
  try {
    const { notificationId } = notificationIdParam.parse(req.params);
    const notification = await NotificationService.markAsRead(req.userId!, notificationId);
    res.json(ok({ notification }));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.delete('/:notificationId', async (req, res, next) => {
  try {
    const { notificationId } = notificationIdParam.parse(req.params);
    await NotificationService.deleteNotification(req.userId!, notificationId);
    res.json(ok({}));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.delete('/read', async (req, res, next) => {
  try {
    const deletedCount = await NotificationService.deleteReadNotifications(req.userId!);
    res.json(ok({ deletedCount }));
  } catch (err) {
    next(err);
  }
});
