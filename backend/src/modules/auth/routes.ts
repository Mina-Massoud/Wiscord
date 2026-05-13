import { Router, type Request, type Response, type NextFunction } from 'express';
import { env } from '../../lib/env.js';
import { ok } from '../../lib/response.js';
import { signSessionToken } from '../../lib/jwt.js';
import { setSessionCookie, clearSessionCookie } from '../../lib/cookies.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  callbackQuery,
  checkUsernameQuery,
  magicLinkBody,
  updateProfileBody,
} from './schemas.js';
import {
  consumeMagicLink,
  getCurrentUser,
  isUsernameAvailable,
  startMagicLink,
  updateProfile,
} from './service.js';

export const authRouter: Router = Router();

/**
 * POST /auth/magic-link
 * Body: { email, redirectTo? }
 * Sends a one-time sign-in link. Always returns 200 to avoid leaking
 * which emails are registered (anti-enumeration).
 */
authRouter.post('/magic-link', async (req, res, next) => {
  try {
    const { email, redirectTo } = magicLinkBody.parse(req.body);
    await startMagicLink(email, redirectTo);
    res.json(ok({ sent: true } as const));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/callback?token=...
 * The user clicked the email link. Verify, set the session cookie, and
 * 302 to the frontend so the SPA hydrates state via /auth/me.
 */
authRouter.get('/callback', async (req, res, next) => {
  try {
    const { token } = callbackQuery.parse(req.query);
    const { userId, redirectTo } = await consumeMagicLink(token);

    const jwt = await signSessionToken(userId);
    setSessionCookie(res, jwt);

    const safeRedirect = sanitizeRedirect(redirectTo);
    res.redirect(safeRedirect);
  } catch (err) {
    // Bounce to frontend's sign-in with an error code so the SPA can show it.
    if (err instanceof Error && err.message.includes('invalid_or_expired_token')) {
      res.redirect(`${env.FRONTEND_ORIGIN}/sign-in?error=expired_link`);
      return;
    }
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

function sanitizeRedirect(redirectTo: string | null): string {
  if (!redirectTo) return env.FRONTEND_ORIGIN;
  // Only same-origin paths — never trust an absolute URL from a token.
  if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
    return `${env.FRONTEND_ORIGIN}${redirectTo}`;
  }
  return env.FRONTEND_ORIGIN;
}
