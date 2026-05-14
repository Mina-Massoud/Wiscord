import { Router, raw } from 'express';

import { env } from '../../lib/env.js';
import { ok } from '../../lib/response.js';
import { badRequest } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { MediaKind } from '../../db/models/index.js';
import { mediaIdParam, uploadHeaders } from './schemas.js';
import { uploadMedia, getMediaForViewer, deleteMedia } from './service.js';

export const storageRouter: Router = Router();

/**
 * POST /storage/upload
 * Headers: Content-Type, X-Filename (URL-encoded), X-Storage-Kind,
 *          optional X-Channel-Id
 * Body:    raw bytes of the file
 *
 * Raw bytes + headers instead of multipart so we don't need multer. Single
 * file per request by design — the frontend's `useUploadMedia` calls this
 * once per file when multiple are picked.
 */
storageRouter.post(
  '/upload',
  requireAuth,
  raw({
    type: '*/*',
    // +1 KB so the parser doesn't reject right at the boundary; service.ts
    // re-checks against STORAGE_MAX_BYTES and rejects with our error shape.
    limit: env.STORAGE_MAX_BYTES + 1024,
  }),
  async (req, res, next) => {
    try {
      const headers = uploadHeaders.parse({
        'content-type': req.header('content-type') ?? '',
        'x-filename': req.header('x-filename') ?? '',
        'x-storage-kind': req.header('x-storage-kind') ?? 'document',
        'x-channel-id': req.header('x-channel-id') || undefined,
      });

      if (!(req.body instanceof Buffer)) {
        throw badRequest('invalid_body', 'Upload body must be raw bytes');
      }

      const asset = await uploadMedia({
        ownerId: req.userId!,
        bytes: req.body,
        mimeType: headers['content-type'],
        fileName: safeDecode(headers['x-filename']),
        kind: headers['x-storage-kind'] as MediaKind,
        channelId: headers['x-channel-id'] ?? null,
      });

      res.status(201).json(ok(asset));
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /storage/:id
 * Streams the original bytes back through this server. The frontend never
 * sees Telegram URLs (MTProto doesn't expose any — we pipe chunks directly).
 */
storageRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = mediaIdParam.parse(req.params);
    const { doc, stream } = await getMediaForViewer({ id, viewerId: req.userId! });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Length', String(doc.size));
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName ?? 'file')}`,
    );
    // Private cache — every asset is per-user-gated, never a CDN edge.
    res.setHeader('Cache-Control', 'private, max-age=300');

    try {
      for await (const chunk of stream) {
        // Backpressure: if the client is slow, wait for drain so we don't
        // balloon memory holding queued chunks.
        if (!res.write(chunk)) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
      res.end();
    } catch (streamErr) {
      // Headers already sent — destroy the socket rather than try to write
      // a JSON error envelope on top of half a file.
      res.destroy(streamErr instanceof Error ? streamErr : undefined);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /storage/:id
 * Removes the index row and best-effort deletes the underlying Telegram
 * message. If Telegram refuses (>48h-old messages sometimes do), the row is
 * still gone from our side — the asset is unreachable, which is what users
 * actually care about.
 */
storageRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = mediaIdParam.parse(req.params);
    await deleteMedia({ id, ownerId: req.userId! });
    res.json(ok({ deleted: true }));
  } catch (err) {
    next(err);
  }
});

function safeDecode(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
