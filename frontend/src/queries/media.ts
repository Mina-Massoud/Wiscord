import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { API_URL, ApiError, type ApiResponse } from '@/queries/client';

export type MediaKind = 'image' | 'audio' | 'video' | 'gif' | 'document';

export interface UploadedAsset {
  id: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  originalName: string;
  /** Path on our backend — pair with `mediaUrl()` to get an absolute URL. */
  url: string;
  channelId: string | null;
  createdAt: string;
}

/**
 * Absolute URL for a stored asset. Use this as the `src` of an `<img>`,
 * `<video>`, `<audio>`, or anchor — the backend proxies bytes back from
 * Telegram so the frontend never sees Telegram URLs (those expire).
 *
 * IMPORTANT — cross-origin cookies: `/storage/:id` is auth-gated. When the
 * frontend dev server (5173) and backend (3001) differ in origin, set
 * `crossOrigin="use-credentials"` on the consuming element, otherwise the
 * browser won't send the `wiscord_session` cookie and the request 401s.
 * In production with a same-origin deploy you can drop the attribute.
 */
export function mediaUrl(id: string): string {
  return `${API_URL}/storage/${id}`;
}

/**
 * Classify a File into one of our storage kinds based on its MIME type.
 * Used by drag/drop and paste handlers that don't know what they're getting.
 */
export function kindForFile(file: File): MediaKind {
  const t = file.type.toLowerCase();
  if (t === 'image/gif') return 'gif';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'document';
}

/**
 * Upload a file and return the asset, without React Query. Used inside
 * tldraw's asset store and other non-component contexts where hooks aren't
 * available. Throws `ApiError` on failure.
 */
export async function uploadMediaFile(input: {
  file: File;
  kind: MediaKind;
  channelId?: string;
  signal?: AbortSignal;
}): Promise<UploadedAsset> {
  const headers: Record<string, string> = {
    'Content-Type': input.file.type || 'application/octet-stream',
    'X-Filename': encodeURIComponent(input.file.name),
    'X-Storage-Kind': input.kind,
  };
  if (input.channelId) headers['X-Channel-Id'] = input.channelId;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/storage/upload`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: input.file,
      signal: input.signal,
    });
  } catch (err) {
    throw new ApiError(0, 'network', 'Upload failed. Check your connection.', err);
  }

  const parsed = (await response.json()) as ApiResponse<UploadedAsset>;
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      parsed.error.code,
      parsed.error.message,
      parsed.error.details,
    );
  }
  return parsed.data;
}

/**
 * Fetch the bytes of a stored asset, return a same-origin `blob:` URL that
 * any `<img>` / `<video>` / `<audio>` can use without cross-origin cookie
 * gymnastics. The caller owns the lifetime: call `URL.revokeObjectURL` when
 * the URL is no longer in use (tldraw's asset store handles this via its
 * own WeakCache).
 */
export async function fetchMediaBlobUrl(id: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(mediaUrl(id), {
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    throw new ApiError(
      response.status,
      'media_fetch_failed',
      `Media ${id} could not be loaded (${response.status})`,
    );
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export interface UploadMediaInput {
  file: File;
  kind: MediaKind;
  channelId?: string;
}

/**
 * Uploads a single file to `/storage/upload`. The endpoint takes raw bytes
 * (not multipart) with metadata in headers, so we bypass the typed `api()`
 * wrapper and call `fetch` directly — but only here, inside `queries/`, per
 * the project rule that components never reach for `fetch` themselves.
 *
 * `useMutation` rather than `useQuery` because the action only runs on the
 * user's command (button click, drag-drop), and the response is one-shot.
 */
export function useUploadMedia(): UseMutationResult<UploadedAsset, ApiError, UploadMediaInput> {
  return useMutation<UploadedAsset, ApiError, UploadMediaInput>({
    mutationFn: (input) => uploadMediaFile(input),
  });
}

/**
 * Deletes an asset by id. Removes the index row first, then best-effort
 * deletes the underlying Telegram message — the asset is unreachable from
 * our API the moment the row is gone, even if Telegram refuses cleanup.
 */
export function useDeleteMedia(): UseMutationResult<void, ApiError, string> {
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      let response: Response;
      try {
        response = await fetch(`${API_URL}/storage/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (err) {
        throw new ApiError(0, 'network', 'Delete failed. Check your connection.', err);
      }

      const parsed = (await response.json()) as ApiResponse<{ deleted: true }>;
      if (!parsed.success) {
        throw new ApiError(
          response.status,
          parsed.error.code,
          parsed.error.message,
          parsed.error.details,
        );
      }
    },
  });
}
