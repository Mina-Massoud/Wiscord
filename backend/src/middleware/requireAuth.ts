import type { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE } from '../lib/cookies.js';
import { verifySessionToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by requireAuth — the authenticated user's id. */
    userId?: string;
  }
}

/**
 * Reads the session cookie, verifies the JWT, attaches `req.userId`.
 * Rejects with 401 if the cookie is missing or invalid.
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
    req.userId = claims.sub;
    next();
  } catch {
    next(unauthorized('Session expired or invalid'));
  }
}
