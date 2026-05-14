import { z } from 'zod';

import { WATCH_PARTY_STATES, WATCH_SOURCE_KINDS } from '../../db/models/WatchParty.js';

export const channelIdParam = z.object({
  channelId: z.string().uuid('channelId must be a UUID'),
});
export type ChannelIdParam = z.infer<typeof channelIdParam>;

/**
 * Start (or reset) the party in a channel. Source URL is validated as a URL
 * up to 2048 chars — actual kind detection runs client-side, but we keep the
 * kind here so server-side serialization is self-describing.
 */
export const startPartyBody = z.object({
  source: z.object({
    kind: z.enum(WATCH_SOURCE_KINDS),
    url: z.string().url('source.url must be a valid URL').max(2048),
    title: z.string().min(1).max(280).nullable().optional(),
  }),
});
export type StartPartyBody = z.infer<typeof startPartyBody>;

/**
 * Host-only control command. `timeMs` is the requested playhead position;
 * the server stamps `lastTickAt` to `Date.now()` so viewers can drift-correct.
 * Pause sends the current time too so viewers freeze on the exact frame.
 */
export const controlBody = z.object({
  action: z.enum(['play', 'pause', 'seek']),
  timeMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
});
export type ControlBody = z.infer<typeof controlBody>;

export const transferHostBody = z.object({
  toUserId: z.string().min(1).max(64),
});
export type TransferHostBody = z.infer<typeof transferHostBody>;

export const watchPartyResponseSchema = z.object({
  channelId: z.string(),
  hostUserId: z.string(),
  source: z.object({
    kind: z.enum(WATCH_SOURCE_KINDS),
    url: z.string(),
    title: z.string().nullable(),
  }),
  state: z.enum(WATCH_PARTY_STATES),
  currentTimeMs: z.number(),
  lastTickAt: z.string(),
  startedAt: z.string(),
});
export type WatchPartyResponse = z.infer<typeof watchPartyResponseSchema>;
