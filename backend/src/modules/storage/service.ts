import { MediaAsset, type MediaAssetDoc, type MediaKind } from '../../db/models/index.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { env } from '../../lib/env.js';
import {
  uploadDocument,
  streamMedia,
  deleteStorageMessage,
} from './telegram-client.js';

export interface UploadInput {
  ownerId: string;
  bytes: Buffer;
  mimeType: string;
  fileName: string;
  kind: MediaKind;
  channelId?: string | null;
}

export interface UploadedAsset {
  id: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  originalName: string;
  url: string;
  channelId: string | null;
  createdAt: string;
}

function publicUrlFor(id: string): string {
  // Frontend reads bytes through our backend, never directly from Telegram —
  // MTProto file references rotate every ~24 h, and the frontend doesn't
  // speak MTProto anyway.
  return `/storage/${id}`;
}

/**
 * Push bytes into Telegram, persist the index row, return the public handle.
 * Enforces the byte ceiling here (not just at the route layer) so any future
 * internal caller — e.g. a background importer — gets the same guard.
 */
export async function uploadMedia(input: UploadInput): Promise<UploadedAsset> {
  if (input.bytes.length === 0) {
    throw badRequest('empty_upload', 'Upload body is empty');
  }
  if (input.bytes.length > env.STORAGE_MAX_BYTES) {
    throw badRequest(
      'upload_too_large',
      `File exceeds ${env.STORAGE_MAX_BYTES} bytes (configurable via STORAGE_MAX_BYTES)`,
    );
  }

  const uploaded = await uploadDocument({
    bytes: input.bytes,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });

  const doc = await MediaAsset.create({
    ownerId: input.ownerId,
    channelId: input.channelId ?? null,
    kind: input.kind,
    mimeType: uploaded.mimeType,
    size: uploaded.size,
    originalName: uploaded.fileName,
    telegramMessageId: uploaded.telegramMessageId,
  });

  return toUploadedAsset(doc);
}

function toUploadedAsset(doc: MediaAssetDoc): UploadedAsset {
  return {
    id: String(doc._id),
    kind: doc.kind as MediaKind,
    mimeType: doc.mimeType,
    size: doc.size,
    originalName: doc.originalName ?? '',
    url: publicUrlFor(String(doc._id)),
    channelId: doc.channelId ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

/**
 * Authorize a viewer for a media id, then return the async iterator of
 * bytes plus the metadata the route needs to set response headers.
 *
 * Ownership-only for now. TODO(channel-team): once channels ship, also allow
 * access when the viewer is a member of `channelId`.
 */
export async function getMediaForViewer(input: {
  id: string;
  viewerId: string;
}): Promise<{
  doc: MediaAssetDoc;
  stream: AsyncIterable<Buffer>;
}> {
  const doc = await MediaAsset.findById(input.id);
  if (!doc) throw notFound('media');

  if (doc.ownerId !== input.viewerId) {
    throw forbidden('Media not visible to this user');
  }

  const stream = await streamMedia(doc.telegramMessageId);
  return { doc, stream };
}

export async function deleteMedia(input: { id: string; ownerId: string }): Promise<void> {
  const doc = await MediaAsset.findById(input.id);
  if (!doc) throw notFound('media');
  if (doc.ownerId !== input.ownerId) {
    throw forbidden('Cannot delete another user’s media');
  }

  await doc.deleteOne();
  await deleteStorageMessage(doc.telegramMessageId);
}
