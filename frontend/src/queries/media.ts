import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';

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

const STORAGE_PREFIX = `${API_URL}/storage/`;

/**
 * Pull the storage id out of a `mediaUrl(id)` string, or return `null` if
 * the URL doesn't point at our backend (data: identicons, /logo/*, external
 * images, etc.). Used by `<MediaImg>` to decide whether the source needs
 * the credentialed-fetch + blob-cache treatment.
 */
export function extractStorageId(url: string): string | null {
  if (!url.startsWith(STORAGE_PREFIX)) return null;
  const tail = url.slice(STORAGE_PREFIX.length);
  // Strip any trailing query string / hash so different cache-busters still
  // resolve to the same id.
  const cleaned = tail.split(/[?#]/)[0];
  return cleaned.length > 0 ? cleaned : null;
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

/**
 * Resolve a backend storage URL to a same-origin `blob:` URL, cached in
 * memory for the SPA session via TanStack Query.
 *
 * Why this exists: browsers are flaky about caching credentialed cross-
 * origin `<img>` responses even with proper `Cache-Control` + `ETag`. By
 * fetching the bytes once via `fetch(..., { credentials: 'include' })`,
 * wrapping the result in a `blob:` URL, and pinning that string in the
 * query cache, every subsequent render of the same id is a same-origin
 * lookup with zero network — survives panel re-mounts and route changes.
 *
 * For non-storage sources (data: URLs, public assets like `/logo/foo.webp`,
 * external images), this is a pass-through.
 *
 * Lifetime: the underlying Blob is rooted by the URL string. The cleanup
 * subscriber wired up in `queries/client.ts` calls `URL.revokeObjectURL`
 * when the entry is gc'd by TanStack Query (`gcTime` below).
 */
export function useMediaBlobUrl(src: string | null | undefined): string | null {
  const id = typeof src === 'string' ? extractStorageId(src) : null;

  const query = useQuery({
    queryKey: mediaBlobKey(id ?? ''),
    queryFn: ({ signal }) => fetchMediaBlobUrl(id!, signal),
    enabled: id !== null,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 0,
  });

  if (id === null) return src ?? null;
  return query.data ?? null;
}

/** Query key factory for the blob cache — kept here so the cleanup subscriber
 * in `queries/client.ts` can match on the same shape without circular imports. */
export function mediaBlobKey(id: string): readonly ['media-blob', string] {
  return ['media-blob', id] as const;
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
