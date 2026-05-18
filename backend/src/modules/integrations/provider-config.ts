import { env } from '../../lib/env.js';
import type { IntegrationProvider } from '../../db/models/Integration.js';

/**
 * Per-provider OAuth config. Kept in one file so adding a third provider
 * (Apple Music, SoundCloud, …) is a single object to fill out.
 *
 * Identity endpoint shapes:
 *  - Spotify  https://api.spotify.com/v1/me           → { id, display_name, email }
 *  - Google   https://www.googleapis.com/oauth2/v2/userinfo
 *                                                      → { id, email, name }
 */

export interface ProviderConfig {
  provider: IntegrationProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  identityUrl: string;
  /** Space-delimited scopes the user is asked to grant. */
  scopes: string;
  /** Extra params appended to the authorize URL. */
  extraAuthorizeParams: Record<string, string>;
  /** Map provider identity payload → display handle for the settings UI. */
  identityHandle: (payload: unknown) => { providerUserId: string; handle: string | null };
  /** Optional token revoke endpoint hit on disconnect (best-effort). */
  revokeUrl: ((accessToken: string) => { url: string; method: 'POST'; body?: string }) | null;
}

interface IdentityShape {
  id?: string;
  display_name?: string | null;
  email?: string | null;
  name?: string | null;
}

function pickHandle(payload: unknown): { providerUserId: string; handle: string | null } {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('provider identity: non-object payload');
  }
  const p = payload as IdentityShape;
  if (!p.id) throw new Error('provider identity: missing id');
  const handle = p.display_name || p.email || p.name || null;
  return { providerUserId: p.id, handle };
}

/**
 * Returns config for a provider, or `null` if its env vars aren't set.
 * Callers throw a friendly 503 when null.
 */
export function getProviderConfig(provider: IntegrationProvider): ProviderConfig | null {
  if (provider === 'spotify') {
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_REDIRECT_URI) {
      return null;
    }
    return {
      provider: 'spotify',
      clientId: env.SPOTIFY_CLIENT_ID,
      clientSecret: env.SPOTIFY_CLIENT_SECRET,
      redirectUri: env.SPOTIFY_REDIRECT_URI,
      authorizeUrl: 'https://accounts.spotify.com/authorize',
      tokenUrl: 'https://accounts.spotify.com/api/token',
      identityUrl: 'https://api.spotify.com/v1/me',
      // Identity + read-only now-playing presence. We deliberately leave
      // out playback-control scopes (modify-playback-state, streaming) —
      // Wiscord doesn't drive Spotify, it just mirrors what the user is
      // playing elsewhere. Currently-playing reads work for free + Premium.
      scopes: [
        'user-read-email',
        'user-read-private',
        'user-read-currently-playing',
        'user-read-playback-state',
      ].join(' '),
      extraAuthorizeParams: { show_dialog: 'true' },
      identityHandle: pickHandle,
      revokeUrl: null, // Spotify has no revoke endpoint — disconnect is local-only.
    };
  }

  if (provider === 'google') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      return null;
    }
    return {
      provider: 'google',
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      identityUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scopes: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/youtube.readonly',
      ].join(' '),
      // `access_type=offline` + `prompt=consent` is what coaxes a refresh_token
      // out of Google. Without it, Google only returns refresh tokens on the
      // first ever consent — reconnects silently drop the refresh path.
      extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
      identityHandle: pickHandle,
      revokeUrl: (accessToken) => ({
        url: `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
        method: 'POST',
      }),
    };
  }

  return null;
}
