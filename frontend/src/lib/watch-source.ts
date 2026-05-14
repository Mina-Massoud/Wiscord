import type { WatchSourceKind } from '@/queries/client';

export interface DetectedSource {
  kind: WatchSourceKind;
  /** The canonical URL we'll send to the backend. */
  url: string;
  /** Provider-specific id (e.g. YouTube video id) — used by the player. */
  providerId: string | null;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

const DIRECT_VIDEO_EXTENSIONS = /\.(mp4|webm|mkv|mov|m4v|ogv)$/i;

/**
 * Best-effort URL → source classification. Returns null if the URL is
 * malformed or the format is unsupported.
 *
 * Supported:
 *   - YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, /embed/ID
 *   - Direct video files: any https URL ending in mp4/webm/mkv/mov/m4v/ogv
 *
 * Anything else (Netflix, Vimeo, arbitrary HTML pages) returns null today.
 * Vimeo + others can be added by extending this switch; the rest of the
 * pipeline is provider-agnostic.
 */
export function detectWatchSource(raw: string): DetectedSource | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  // YouTube ─────────────────────────────────────────────────────────────────
  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const id = extractYouTubeId(url);
    if (!id) return null;
    return {
      kind: 'youtube',
      url: `https://www.youtube.com/watch?v=${id}`,
      providerId: id,
    };
  }

  // Direct video ────────────────────────────────────────────────────────────
  if (DIRECT_VIDEO_EXTENSIONS.test(url.pathname)) {
    return {
      kind: 'direct',
      url: url.toString(),
      providerId: null,
    };
  }

  return null;
}

function extractYouTubeId(url: URL): string | null {
  if (url.hostname === 'youtu.be') {
    const id = url.pathname.replace(/^\/+/, '').split('/')[0] ?? '';
    return isValidYouTubeId(id) ? id : null;
  }
  // youtube.com/watch?v=…
  const v = url.searchParams.get('v');
  if (v && isValidYouTubeId(v)) return v;
  // /embed/ID, /shorts/ID, /live/ID, /v/ID
  const segments = url.pathname.split('/').filter(Boolean);
  for (let i = 0; i < segments.length - 1; i++) {
    if (['embed', 'shorts', 'live', 'v'].includes(segments[i]!)) {
      const candidate = segments[i + 1] ?? '';
      if (isValidYouTubeId(candidate)) return candidate;
    }
  }
  return null;
}

function isValidYouTubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/**
 * Friendly label for a source. Used by the host banner ("hosting <label>")
 * and the cached "Recents" entries. Falls back to the bare URL hostname
 * when nothing nicer is available.
 */
export function describeSource(source: { kind: WatchSourceKind; url: string }): string {
  if (source.kind === 'screen') return 'Shared screen';
  try {
    const url = new URL(source.url);
    if (source.kind === 'youtube') return `YouTube · ${url.host}`;
    return url.hostname;
  } catch {
    return source.url;
  }
}
