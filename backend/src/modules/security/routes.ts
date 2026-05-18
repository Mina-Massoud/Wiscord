import { Router } from 'express';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { signSessionToken } from '../../lib/jwt.js';
import { setSessionCookie } from '../../lib/cookies.js';
import { bumpSessionsValidAfter, getCurrentSession } from './service.js';

export const securityRouter: Router = Router();

securityRouter.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const session = await getCurrentSession({
      userId: req.userId!,
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    // Strip the internal-only rawSignedInAt before sending.
    const { rawSignedInAt: _drop, ...payload } = session;
    void _drop;
    res.json(ok({ current: payload }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /security/sign-out-others
 * Bumps sessionsValidAfter so all other JWTs are rejected, then re-issues
 * a fresh cookie for the caller so they stay signed in on this device.
 */
securityRouter.post('/sign-out-others', requireAuth, async (req, res, next) => {
  try {
    const signedOutAt = await bumpSessionsValidAfter(req.userId!);
    const fresh = await signSessionToken(req.userId!);
    setSessionCookie(res, fresh);
    res.json(ok({ signedOutAt: signedOutAt.toISOString() } as const));
  } catch (err) {
    next(err);
  }
});
