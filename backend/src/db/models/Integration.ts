import { Schema, model, type HydratedDocument } from 'mongoose';
import { applySerialize } from '../serialize.js';

export const INTEGRATION_PROVIDERS = ['spotify', 'google'] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

/**
 * One row per (user, provider) — third-party OAuth connection.
 *
 * - `google` covers YouTube Music: we OAuth into the user's Google account
 *   with the youtube.readonly scope and read music data via the YouTube
 *   Data API v3. (YouTube Music has no public OAuth API of its own.)
 * - Tokens are encrypted at rest via lib/crypto/encryptToken so a DB leak
 *   doesn't hand an attacker working OAuth credentials.
 * - `providerHandle` is the display string ("@mina", "mina@gmail.com") so
 *   the settings UI can render "Connected as …" without round-tripping
 *   to the provider.
 *
 * Explicit `IntegrationRow` shape (matches the Mongoose 9 trick used in
 * `VoiceActivity.ts` / `Quiz.ts`) — `InferSchemaType` chokes on nullable
 * enum fields with "Type instantiation is excessively deep".
 */
export interface IntegrationRow {
  userId: string;
  provider: IntegrationProvider;
  providerUserId: string;
  providerHandle: string | null;
  scopes: string[];
  accessTokenCipher: string;
  refreshTokenCipher: string | null;
  accessTokenExpiresAt: Date | null;
  connectedAt: Date;
  lastRefreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: INTEGRATION_PROVIDERS, required: true },
    providerUserId: { type: String, required: true },
    providerHandle: { type: String, default: null },
    scopes: { type: [String], default: [] },
    accessTokenCipher: { type: String, required: true },
    refreshTokenCipher: { type: String, default: null },
    accessTokenExpiresAt: { type: Date, default: null },
    connectedAt: { type: Date, default: () => new Date() },
    lastRefreshedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'integrations' },
);

// One connection per (user, provider). Reconnecting upserts the same row.
integrationSchema.index({ userId: 1, provider: 1 }, { unique: true });

applySerialize(integrationSchema);

export type IntegrationDoc = HydratedDocument<IntegrationRow>;
export const Integration = model<IntegrationRow>('Integration', integrationSchema);
