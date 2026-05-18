import type { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE } from '../lib/cookies.js';
import { verifySessionToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';
import { User } from '../db/models/User.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by requireAuth — the authenticated user's id. */
    userId?: string;
  }
}

/**
 * Reads the session cookie, verifies the JWT, attaches `req.userId`.
 * Rejects with 401 if the cookie is missing or invalid.
 *
 * Also rejects tokens whose `iat` predates the user's `sessionsValidAfter`
 * — that field is bumped by `POST /security/sign-out-others`, so JWTs issued
 * before then are treated as revoked.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== 'string') {
    return next(unauthorized('Sign in required'));
  }

  try {
    const claims = await verifySessionToken(token);

    // Token must carry an iat for the revocation check to be meaningful.
    if (typeof claims.iat !== 'number') {
      return next(unauthorized('Session expired or invalid'));
    }

    const user = await User.findById(claims.sub)
      .select({ 'security.sessionsValidAfter': 1 })
      .lean<{ security?: { sessionsValidAfter: Date | null } } | null>();

    if (!user) {
      return next(unauthorized('Session expired or invalid'));
    }

    const validAfter = user.security?.sessionsValidAfter;
    if (validAfter instanceof Date && claims.iat * 1000 < validAfter.getTime()) {
      return next(unauthorized('Session revoked'));
    }

    req.userId = claims.sub;
    next();
  } catch {
    next(unauthorized('Session expired or invalid'));
  }
}
