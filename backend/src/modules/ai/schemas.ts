import { z } from 'zod';

/**
 * Request body for POST /ai/ask. `scope` lets the same endpoint serve
 * the future channel / server / voice tiers without route duplication;
 * only `personal` is implemented in v1. The other values are accepted
 * by the schema but rejected with `scope_not_implemented` at the
 * service layer so a client adding them early gets a clear 501 rather
 * than a 400 + zod error.
 */
export const AI_SCOPES = ['personal', 'channel', 'server', 'voice'] as const;
export type AiScope = (typeof AI_SCOPES)[number];

export const askBodySchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'question cannot be empty')
    .max(2000, 'question cannot exceed 2000 characters'),
  scope: z.enum(AI_SCOPES).default('personal'),
  /**
   * IANA timezone of the caller (e.g. 'Africa/Cairo'). Used by
   * the context-builder to anchor "tomorrow" / "9 AM" to the
   * user's local clock instead of UTC. Optional — falls back to
   * UTC if absent.
   */
  timezone: z.string().min(1).max(64).optional(),
  /**
   * Optional scope target — channelId for `channel`, serverId for
   * `server`, voice roomId for `voice`. Ignored when scope is
   * `personal`. Kept in the schema so the future scopes don't need
   * a request-shape migration.
   */
  scopeId: z.string().min(1).optional(),
});

export type AskBody = z.infer<typeof askBodySchema>;

/**
 * Body for POST /ai/tools/confirm/:callId. Server-side validation
 * mirrors what the route handler was doing inline; centralising it
 * here keeps the route layer thin and lets future clients use the
 * same Zod schema for shared types.
 */
export const confirmToolBodySchema = z.object({
  action: z.enum(['confirm', 'decline']),
});

export type ConfirmToolBody = z.infer<typeof confirmToolBodySchema>;
