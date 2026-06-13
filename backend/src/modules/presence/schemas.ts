import { z } from 'zod';

import type { PresenceStatus } from './presence-store.js';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * `GET /presence?userIds=a,b,c` — a comma-separated list of user ids. We split
 * + trim + drop empties, then validate each as an ObjectId and cap the batch
 * at 200 (a friends list never approaches that, so it's a generous DoS guard).
 */
export const presenceQuery = z.object({
  userIds: z
    .string()
    .transform((raw) => raw.split(',').map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string().regex(OBJECT_ID, 'invalid user id')).max(200)),
});

export type PresenceMapDto = Record<string, PresenceStatus>;
