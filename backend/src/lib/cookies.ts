import type { Response, CookieOptions } from 'express';
import { env } from './env.js';

export const SESSION_COOKIE = 'wiscord_session';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    ...baseOptions(),
    maxAge: env.SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  // Match attributes used when the cookie was set so the browser drops it.
  res.clearCookie(SESSION_COOKIE, baseOptions());
}
