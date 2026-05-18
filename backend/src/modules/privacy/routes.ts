import { Router } from 'express';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { privacyPatchBody } from './schemas.js';
import { getPrivacy, updatePrivacy } from './service.js';

export const privacyRouter: Router = Router();

privacyRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const data = await getPrivacy(req.userId!);
    res.json(ok(data));
  } catch (err) {
    next(err);
  }
});

privacyRouter.patch('/', requireAuth, async (req, res, next) => {
  try {
    const patch = privacyPatchBody.parse(req.body);
    const data = await updatePrivacy(req.userId!, patch);
    res.json(ok(data));
  } catch (err) {
    next(err);
  }
});
