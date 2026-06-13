import type { Response, CookieOptions } from 'express';
import { env } from './env.js';

export const SESSION_COOKIE = 'wiscord_session';

function baseOptions(): CookieOptions {
  // In production the frontend (Vercel) and backend (Render) live on different
  // origins, so the session cookie rides cross-site XHR/fetch requests. Browsers
  // only attach a cookie on cross-site requests when it is SameSite=None *and*
  // Secure — `lax` would be silently dropped and every authed call would 401.
  // Locally everything is same-origin-ish over http, so keep lax + insecure.
  const crossSite = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: crossSite ? 'none' : 'lax',
    secure: crossSite,
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
