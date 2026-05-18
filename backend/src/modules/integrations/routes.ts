import { Router } from 'express';
import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { providerParam, callbackQuery, musicSearchQuery } from './schemas.js';
import {
  listIntegrations,
  startConnect,
  completeCallback,
  disconnect,
  searchYouTubeMusic,
} from './service.js';

export const integrationsRouter: Router = Router();

integrationsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const data = await listIntegrations(req.userId!);
    res.json(ok(data));
  } catch (err) {
    next(err);
  }
});

integrationsRouter.get('/:provider/start', requireAuth, async (req, res, next) => {
  try {
    const { provider } = providerParam.parse(req.params);
    const result = await startConnect(req.userId!, provider);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

/**
 * Callback is NOT auth-gated — the user comes in from the provider's
 * redirect with no session cookie in their browser tab necessarily fresh.
 * Auth comes from the signed `state` JWT, which carries the userId.
 *
 * On success: redirect to the frontend's settings dialog with a query
 * param so the UI can fire a success toast and refresh its list.
 * On failure: same redirect, but with `error=…` instead.
 */
integrationsRouter.get('/:provider/callback', async (req, res, _next) => {
  let provider: string | undefined;
  try {
    const parsed = providerParam.parse(req.params);
    provider = parsed.provider;
    const { code, state, error } = callbackQuery.parse(req.query);
    await completeCallback({ provider: parsed.provider, code, state, error });
    const url = new URL('/app', env.FRONTEND_ORIGIN);
    url.searchParams.set('settings', 'integrations');
    url.searchParams.set('connected', parsed.provider);
    res.redirect(url.toString());
  } catch (err) {
    // The user is in a browser tab, not an API client — translate the
    // error into a redirect with `?error=<code>` so the frontend toasts.
    // Don't `next(err)` after redirect; that double-writes headers and
    // crashes the error middleware (ERR_HTTP_HEADERS_SENT).
    const code =
      err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
        ? err.code
        : 'oauth_error';
    logger.warn({ provider, err, code }, 'integration callback failed — redirecting with error');
    const url = new URL('/app', env.FRONTEND_ORIGIN);
    url.searchParams.set('settings', 'integrations');
    url.searchParams.set('error', code);
    res.redirect(url.toString());
  }
});

integrationsRouter.delete('/:provider', requireAuth, async (req, res, next) => {
  try {
    const { provider } = providerParam.parse(req.params);
    await disconnect(req.userId!, provider);
    res.json(ok({ disconnected: true }));
  } catch (err) {
    next(err);
  }
});

// ─── Music search (YouTube Music via Google integration) ────────────────
//
// Lives under the integrations module because it relies on the user's
// Google OAuth connection for credentials. Step 2 of the music feature —
// search results land in the music capsule's expanded state and clicking
// one loads the hidden iframe audio engine.
integrationsRouter.get('/google/search', requireAuth, async (req, res, next) => {
  try {
    const { q, limit } = musicSearchQuery.parse(req.query);
    const results = await searchYouTubeMusic(req.userId!, q, limit);
    res.json(ok(results));
  } catch (err) {
    next(err);
  }
});
