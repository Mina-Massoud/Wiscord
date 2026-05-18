import { forwardRef, type ImgHTMLAttributes } from 'react';

import { useMediaBlobUrl } from '@/queries/media';

/**
 * Drop-in `<img>` for any source that may be a backend `/storage/:id` URL.
 *
 * Why this exists: backend storage is gated behind the `wiscord_session`
 * cookie and served cross-origin in dev (5173 → 3001). Browsers handle
 * caching of credentialed cross-origin `<img>` responses inconsistently
 * even with proper `Cache-Control` + `ETag`, so visiting a panel twice
 * often re-downloads the bytes.
 *
 * `MediaImg` sidesteps the issue entirely: storage URLs are routed through
 * `useMediaBlobUrl`, which fetches the bytes once with credentials, hands
 * back a same-origin `blob:` URL, and pins it in the TanStack Query cache
 * for the SPA session. Subsequent renders of the same id — including after
 * panel re-mount, route change, or component remount — are zero-network
 * lookups that just hand the same `blob:` string back.
 *
 * Non-storage sources (data: identicons, `/logo/*` public assets, external
 * images) pass through unchanged.
 *
 * `fallbackSrc` is rendered when the blob fetch is in flight or `src` is
 * nullish. Pass a guaranteed-safe URL — a data: identicon, a public asset
 * — so the user never sees the browser's broken-image glyph during the
 * brief round-trip on cold caches.
 */
interface MediaImgProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const MediaImg = forwardRef<HTMLImageElement, MediaImgProps>(function MediaImg(
  { src, fallbackSrc, ...rest },
  ref,
) {
  const resolvedSrc = useMediaBlobUrl(typeof src === 'string' ? src : null);

  // Paint the fallback while the first blob fetch is in flight. Letting
  // the browser try the raw cross-origin URL would defeat the whole point
  // of routing through the blob cache; rendering `src={undefined}` shows
  // the broken-image glyph at the explicit width/height. `fallbackSrc`
  // bridges that gap with something that always loads (data: identicon,
  // public asset).
  const effectiveSrc = resolvedSrc ?? fallbackSrc;

  return <img ref={ref} src={effectiveSrc} {...rest} />;
});
