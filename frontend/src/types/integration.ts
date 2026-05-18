/**
 * Shared types for music integrations. Step 1 of a music feature across
 * the app — settings can connect/disconnect, future surfaces (now-playing,
 * shared listening) consume the same `IntegrationProvider` union.
 */

export const INTEGRATION_PROVIDERS = ['spotify', 'google'] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  /** Display string the UI renders next to "Connected as …". null if the
   *  provider didn't return a usable handle. */
  providerHandle: string | null;
  scopes: string[];
  connectedAt: string;
  lastRefreshedAt: string | null;
}
