import { z } from 'zod';
import { MEDIA_KINDS } from '../../db/models/index.js';

/**
 * Upload metadata travels in headers (not the body) because the body is the
 * raw file. `X-Filename` is URL-encoded by the client so non-ASCII names
 * survive transport.
 */
export const uploadHeaders = z.object({
  'content-type': z
    .string()
    .min(1, 'content-type header is required')
    .max(255),
  'x-filename': z
    .string()
    .min(1, 'x-filename header is required')
    .max(512),
  'x-storage-kind': z.enum([...MEDIA_KINDS] as [string, ...string[]]).default('document'),
  'x-channel-id': z.string().uuid().optional(),
});
export type UploadHeaders = z.infer<typeof uploadHeaders>;

export const mediaIdParam = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'invalid media id'),
});
export type MediaIdParam = z.infer<typeof mediaIdParam>;
