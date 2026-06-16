import { z } from 'zod';

/**
 * A channel id comes in one of two shapes today:
 *
 *  1. **MongoDB ObjectId** (24 hex chars) — every real server channel, e.g.
 *     `6a2e65b788bf4ef93573b19f`. This is the shape the product uses now that
 *     servers + channels are persisted.
 *  2. **UUID** — the dev-only labs surfaces (`/app/labs/{quiz,notes,whiteboard}`)
 *     mint ad-hoc rooms client-side with `crypto.randomUUID()`, plus the
 *     load-test seeds that use fixed UUIDs.
 *
 * The activity modules (quiz, notes, whiteboard, calendar) were written against
 * the labs UUID shape and rejected real ObjectId channels with a 400. Accepting
 * either shape lets every activity run on a real server channel while keeping
 * the dev labs rooms working. Validate with this in every channel-id boundary.
 */
const OBJECT_ID = '[a-f0-9]{24}';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const CHANNEL_ID_RE = new RegExp(`^(?:${OBJECT_ID}|${UUID})$`, 'i');

export const channelIdSchema = z
  .string()
  .regex(CHANNEL_ID_RE, 'channelId must be an ObjectId or UUID');
