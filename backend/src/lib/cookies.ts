import type { Response, CookieOptions } from 'express';
import { env } from './env.js';

export const SESSION_COOKIE = 'wiscord_session';

function baseOptions(): CookieOptions {
  // In production the frontend (Vercel) and backend (Render) live on different
  // sites (vercel.app vs onrender.com), so the session cookie rides cross-site
  // XHR/fetch/WebSocket requests. Browsers only attach a cookie on cross-site
  // requests when it is SameSite=None *and* Secure — `lax` would be silently
  // dropped and every authed call would 401.
  //
  // But SameSite=None alone is no longer enough: Chrome's third-party-cookie
  // restrictions drop an *unpartitioned* cross-site cookie, which showed up as
  // an intermittent "Sign in required" 401 right after sign-up (the cookie was
  // set on onrender.com but never sent back from the vercel.app page). Marking
  // it `Partitioned` (CHIPS) opts into per-top-level-site storage so Chrome/Edge
  // keep sending it. The partition key is always the vercel.app top-level site,
  // so a single shared session still works across the whole app.
  //
  // NOTE: Safari blocks cross-site cookies entirely (ITP) and doesn't honor
  // CHIPS, so the bulletproof fix remains serving both halves under one
  // registrable domain (app.wiscord.com + api.wiscord.com with Domain=.wiscord
  // .com, SameSite=Lax). Partitioned is the right stopgap for Chromium today.
  //
  // Locally everything is same-origin-ish over http, so keep lax + insecure.
  const crossSite = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: crossSite ? 'none' : 'lax',
    secure: crossSite,
    partitioned: crossSite,
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
