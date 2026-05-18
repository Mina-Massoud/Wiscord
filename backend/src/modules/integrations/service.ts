import { SignJWT, jwtVerify } from 'jose';
import { Integration, type IntegrationProvider } from '../../db/models/Integration.js';
import { encryptToken, decryptToken } from '../../lib/crypto/encryptToken.js';
import { env } from '../../lib/env.js';
import { badRequest, notFound, AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { getProviderConfig, type ProviderConfig } from './provider-config.js';
import type { IntegrationView, MusicTrackView } from './schemas.js';

/**
 * OAuth handshake service. Three public entry points:
 *   - listIntegrations(userId)            → IntegrationView[]
 *   - startConnect(userId, provider)      → { url } the user is redirected to
 *   - completeCallback({ provider, code, state }) → { redirectTo }
 *   - disconnect(userId, provider)        → { ok: true }
 *
 * The `state` parameter is a short-lived signed JWT (10 min TTL) carrying
 * the userId, provider, and the PKCE code_verifier (Spotify). This lets
 * us validate the callback without storing pending OAuth state in the DB.
 */

const STATE_ISSUER = 'wiscord';
const STATE_AUDIENCE = 'wiscord-integrations';
const STATE_TTL_SECONDS = 600;
const STATE_SECRET = new TextEncoder().encode(env.JWT_SECRET);

interface OAuthState {
  uid: string;
  prv: IntegrationProvider;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

function requireConfig(provider: IntegrationProvider): ProviderConfig {
  const cfg = getProviderConfig(provider);
  if (!cfg) {
    throw new AppError(503, 'integration_not_configured', `${provider} is not configured on this server`);
  }
  return cfg;
}

async function signState(payload: OAuthState): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(STATE_ISSUER)
    .setAudience(STATE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(STATE_SECRET);
}

async function verifyState(token: string): Promise<OAuthState> {
  const { payload } = await jwtVerify(token, STATE_SECRET, {
    issuer: STATE_ISSUER,
    audience: STATE_AUDIENCE,
  });
  const uid = payload.uid;
  const prv = payload.prv;
  if (typeof uid !== 'string' || typeof prv !== 'string') {
    throw new Error('state: malformed claims');
  }
  if (prv !== 'spotify' && prv !== 'google') {
    throw new Error('state: unknown provider');
  }
  return { uid, prv };
}

export async function listIntegrations(userId: string): Promise<IntegrationView[]> {
  const rows = await Integration.find({ userId })
    .select({ provider: 1, providerHandle: 1, scopes: 1, connectedAt: 1, lastRefreshedAt: 1 })
    .lean();
  return rows.map((row) => ({
    id: String(row._id),
    provider: row.provider as IntegrationProvider,
    providerHandle: row.providerHandle ?? null,
    scopes: row.scopes ?? [],
    connectedAt: (row.connectedAt ?? row.createdAt ?? new Date()).toISOString(),
    lastRefreshedAt: row.lastRefreshedAt ? row.lastRefreshedAt.toISOString() : null,
  }));
}

export async function startConnect(
  userId: string,
  provider: IntegrationProvider,
): Promise<{ url: string }> {
  const cfg = requireConfig(provider);

  // We're a confidential client (backend with a stored client_secret), so
  // we use the standard Authorization Code Flow + HTTP Basic auth on the
  // token exchange — NOT PKCE. Spotify rejects requests that mix PKCE
  // (code_verifier) with client_secret; pick one. We pick the secret path
  // because the secret never leaves the server.
  const state = await signState({ uid: userId, prv: provider });

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes,
    state,
    ...cfg.extraAuthorizeParams,
  });

  return { url: `${cfg.authorizeUrl}?${params.toString()}` };
}

interface CallbackInput {
  provider: IntegrationProvider;
  code: string | undefined;
  state: string | undefined;
  error: string | undefined;
}

export async function completeCallback(input: CallbackInput): Promise<{ userId: string }> {
  if (input.error) {
    throw badRequest('oauth_error', input.error);
  }
  if (!input.code || !input.state) {
    throw badRequest('oauth_missing_code', 'OAuth callback missing code or state');
  }

  let claims: OAuthState;
  try {
    claims = await verifyState(input.state);
  } catch {
    throw badRequest('oauth_bad_state', 'OAuth state is invalid or expired');
  }

  if (claims.prv !== input.provider) {
    throw badRequest('oauth_provider_mismatch', 'OAuth state does not match provider');
  }

  const cfg = requireConfig(input.provider);

  // Exchange code → tokens via standard Authorization Code Flow.
  // Both Spotify and Google accept client credentials via HTTP Basic auth
  // (RFC 6749 §2.3.1). Using Basic auth instead of body params avoids
  // Spotify's hard rejection of mixed PKCE-vs-secret request shapes.
  const basicAuth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: cfg.redirectUri,
  });

  const tokenRes = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
    },
    body: tokenBody.toString(),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => '');
    logger.warn(
      { provider: input.provider, status: tokenRes.status, detail },
      'oauth token exchange failed',
    );
    throw badRequest('oauth_exchange_failed', 'Could not exchange the authorization code');
  }
  const tokens = (await tokenRes.json()) as TokenResponse;
  if (!tokens.access_token) {
    throw badRequest('oauth_exchange_failed', 'Provider returned no access token');
  }

  // Fetch identity for the display handle. Common failure modes:
  //  - Spotify Dev Mode: app owner missing from Dashboard → Users and Access
  //  - Spotify Premium gate: owner of the app needs an active Premium sub
  //    before any Web API call (incl. /v1/me) is allowed (Spotify policy
  //    rolled out in late 2024)
  const identityRes = await fetch(cfg.identityUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!identityRes.ok) {
    const detail = await identityRes.text().catch(() => '');
    logger.warn(
      { provider: input.provider, status: identityRes.status, detail },
      'oauth identity fetch failed',
    );
    // Surface specific Spotify failure modes so the UI can show a useful
    // message instead of generic "try again".
    if (input.provider === 'spotify' && identityRes.status === 403) {
      if (/premium/i.test(detail)) {
        throw badRequest(
          'oauth_provider_premium_required',
          'The Spotify app owner needs an active Premium subscription',
        );
      }
      if (/user not registered|user might not be registered/i.test(detail)) {
        throw badRequest(
          'oauth_provider_user_not_allowed',
          'Add this user under Spotify Dashboard → Users and Access',
        );
      }
    }
    throw badRequest('oauth_identity_failed', 'Could not read provider identity');
  }
  const identity = (await identityRes.json()) as unknown;
  const { providerUserId, handle } = cfg.identityHandle(identity);

  const expiresAt =
    typeof tokens.expires_in === 'number'
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;
  const grantedScopes = tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : cfg.scopes.split(' ');

  await Integration.findOneAndUpdate(
    { userId: claims.uid, provider: input.provider },
    {
      $set: {
        providerUserId,
        providerHandle: handle,
        scopes: grantedScopes,
        accessTokenCipher: encryptToken(tokens.access_token),
        refreshTokenCipher: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        accessTokenExpiresAt: expiresAt,
        lastRefreshedAt: new Date(),
      },
      $setOnInsert: { connectedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { userId: claims.uid };
}

export async function disconnect(
  userId: string,
  provider: IntegrationProvider,
): Promise<void> {
  const row = await Integration.findOne({ userId, provider });
  if (!row) throw notFound('integration');

  const cfg = getProviderConfig(provider);
  if (cfg?.revokeUrl) {
    try {
      const accessToken = decryptToken(row.accessTokenCipher);
      const { url, method } = cfg.revokeUrl(accessToken);
      const res = await fetch(url, { method });
      if (!res.ok) {
        logger.warn(
          { provider, status: res.status },
          'provider revoke endpoint returned non-2xx — proceeding with local delete',
        );
      }
    } catch (err) {
      logger.warn({ provider, err }, 'provider revoke failed — proceeding with local delete');
    }
  }

  await Integration.deleteOne({ userId, provider });
}

// ─── Token refresh ───────────────────────────────────────────────────────

/**
 * Returns a valid access token for the user's connection, refreshing via
 * the provider's `refresh_token` if the stored access token is expired or
 * within 60 seconds of expiry. Throws `not_found` if the integration
 * doesn't exist; throws `oauth_refresh_failed` if the provider rejects
 * the refresh (token revoked, etc.) — callers should treat that as a
 * disconnect signal.
 */
async function getValidAccessToken(
  userId: string,
  provider: IntegrationProvider,
): Promise<string> {
  const row = await Integration.findOne({ userId, provider });
  if (!row) throw notFound('integration');

  const expiresAt = row.accessTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000;
  if (!needsRefresh) {
    return decryptToken(row.accessTokenCipher);
  }

  if (!row.refreshTokenCipher) {
    // No refresh token — treat as expired connection.
    throw new AppError(401, 'oauth_refresh_required', 'Reconnect this integration');
  }

  const cfg = requireConfig(provider);
  const refreshToken = decryptToken(row.refreshTokenCipher);
  const basicAuth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.warn({ provider, status: res.status, detail }, 'oauth refresh failed');
    throw new AppError(401, 'oauth_refresh_failed', 'Reconnect this integration');
  }
  const tokens = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  const newExpiresAt =
    typeof tokens.expires_in === 'number'
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

  await Integration.updateOne(
    { _id: row._id },
    {
      $set: {
        accessTokenCipher: encryptToken(tokens.access_token),
        ...(tokens.refresh_token
          ? { refreshTokenCipher: encryptToken(tokens.refresh_token) }
          : {}),
        accessTokenExpiresAt: newExpiresAt,
        lastRefreshedAt: new Date(),
      },
    },
  );

  return tokens.access_token;
}

// ─── YouTube Music search (via YT Data API) ──────────────────────────────

interface YouTubeSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  error?: { message?: string };
}

/**
 * Searches YouTube for music videos using the user's Google integration.
 * `videoCategoryId=10` is YouTube's "Music" category — filters out
 * non-music noise (gameplay, vlogs) but isn't 100% strict; results still
 * include lyric videos / covers / live performances.
 *
 * Returns a normalized `MusicTrackView[]` keyed by YouTube video id so the
 * frontend's hidden iframe player can load each one directly.
 */
export async function searchYouTubeMusic(
  userId: string,
  query: string,
  limit: number,
): Promise<MusicTrackView[]> {
  const accessToken = await getValidAccessToken(userId, 'google');

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoCategoryId', '10');
  url.searchParams.set('maxResults', String(limit));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.warn({ status: res.status, detail }, 'youtube search failed');
    // Surface known YouTube failure reasons with distinct codes so the
    // frontend can render specific, useful copy instead of a generic
    // "couldn't search" message.
    if (/authenticatedUserAccountSuspended/i.test(detail)) {
      throw badRequest(
        'youtube_account_suspended',
        'This Google account has a suspended YouTube channel',
      );
    }
    if (/quotaExceeded|dailyLimitExceeded/i.test(detail)) {
      throw badRequest(
        'youtube_quota_exceeded',
        "YouTube's daily quota is used up — try tomorrow",
      );
    }
    throw badRequest('youtube_search_failed', 'Could not search YouTube right now');
  }
  const data = (await res.json()) as YouTubeSearchResponse;

  const items = data.items ?? [];
  return items
    .map<MusicTrackView | null>((item) => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title;
      if (!videoId || !title) return null;
      const thumbnailUrl =
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        '';
      return {
        videoId,
        title,
        artist: item.snippet?.channelTitle ?? '',
        thumbnailUrl,
        durationSeconds: null,
      };
    })
    .filter((row): row is MusicTrackView => row !== null);
}
