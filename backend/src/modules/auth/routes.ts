import { Router, type Request, type Response, type NextFunction } from 'express';
import { ok } from '../../lib/response.js';
import { signSessionToken } from '../../lib/jwt.js';
import { setSessionCookie, clearSessionCookie } from '../../lib/cookies.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  checkUsernameQuery,
  signInBody,
  signUpBody,
  updateProfileBody,
} from './schemas.js';
import {
  getCurrentUser,
  isUsernameAvailable,
  signIn,
  signUp,
  updateProfile,
} from './service.js';

export const authRouter: Router = Router();

/**
 * POST /auth/sign-up
 * Body: { email, password }
 * Creates the account, issues a session cookie, and returns the profile so the
 * SPA can route straight into onboarding without a second round-trip.
 */
authRouter.post('/sign-up', async (req, res, next) => {
  try {
    const { email, password } = signUpBody.parse(req.body);
    const { userId } = await signUp(email, password);

    const jwt = await signSessionToken(userId);
    setSessionCookie(res, jwt);

    const me = await getCurrentUser(userId);
    res.status(201).json(ok(me));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/sign-in
 * Body: { email, password }
 * Verifies the credentials, issues a session cookie, and returns the profile.
 */
authRouter.post('/sign-in', async (req, res, next) => {
  try {
    const { email, password } = signInBody.parse(req.body);
    const { userId } = await signIn(email, password);

    const jwt = await signSessionToken(userId);
    setSessionCookie(res, jwt);

    const me = await getCurrentUser(userId);
    res.json(ok(me));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/signout
 * Clears the session cookie. Idempotent — succeeds even if not signed in.
 */
authRouter.post('/signout', (_req: Request, res: Response, next: NextFunction) => {
  try {
    clearSessionCookie(res);
    res.json(ok({ signedOut: true } as const));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/me
 * Returns the authenticated user's profile.
 */
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const me = await getCurrentUser(req.userId!);
    res.json(ok(me));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /auth/me
 * Update username / displayName / avatarUrl / onboardedAt.
 */
authRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const patch = updateProfileBody.parse(req.body);
    const updated = await updateProfile(req.userId!, patch);
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/check-username?username=foo
 * Cheap availability check. Excludes the caller's own username from the
 * collision set when they're signed in.
 */
authRouter.get('/check-username', async (req, res, next) => {
  try {
    const { username } = checkUsernameQuery.parse(req.query);

    // If the caller has a valid session, exclude their own row so editing
    // your existing username doesn't report "taken".
    let excludeUserId: string | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        requireAuth(req, res, (err) => (err ? reject(err) : resolve()));
      });
      excludeUserId = req.userId ?? null;
    } catch {
      excludeUserId = null;
    }

    const available = await isUsernameAvailable(username, excludeUserId);
    res.json(ok({ available }));
  } catch (err) {
    next(err);
  }
});
