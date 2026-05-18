import { z } from 'zod';
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from '../../db/models/Integration.js';

export const providerParam = z.object({
  provider: z.enum(INTEGRATION_PROVIDERS),
});

export type ProviderParam = z.infer<typeof providerParam>;

export const callbackQuery = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

export type CallbackQuery = z.infer<typeof callbackQuery>;

/** YouTube music search query. */
export const musicSearchQuery = z.object({
  q: z.string().min(1).max(200),
  /** Page size 1..20. YT Data API caps practical results around there. */
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type MusicSearchQuery = z.infer<typeof musicSearchQuery>;

/** Shared shape for a music track surfaced to the frontend. */
export interface MusicTrackView {
  /** YouTube video id — what the iframe player needs to load it. */
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  /** When the YT Data API exposes it (sometimes hidden). */
  durationSeconds: number | null;
}

/**
 * Wire shape returned by `GET /integrations` and the per-provider start
 * response. Tokens never leave the server — clients only see metadata.
 */
export interface IntegrationView {
  id: string;
  provider: IntegrationProvider;
  providerHandle: string | null;
  scopes: string[];
  connectedAt: string;
  lastRefreshedAt: string | null;
}
