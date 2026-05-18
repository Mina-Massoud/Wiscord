import type { MusicTrack } from '@/types/music';

const SEARCH_ERROR_COPY: Record<string, string> = {
  youtube_account_suspended:
    "This Google account's YouTube channel is suspended. Reconnect with a different account in Settings.",
  youtube_quota_exceeded: "YouTube's daily quota is used up. Try again tomorrow.",
  oauth_refresh_required: 'Reconnect YouTube Music in Settings to keep searching.',
  oauth_refresh_failed: 'Reconnect YouTube Music in Settings to keep searching.',
};

function readErrorCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  return null;
}

interface SearchResultsProps {
  query: string;
  results: MusicTrack[];
  loading: boolean;
  error: unknown;
  onPick: (track: MusicTrack) => void;
}

export function SearchResults({
  query,
  results,
  loading,
  error,
  onPick,
}: SearchResultsProps): React.JSX.Element | null {
  if (query.trim().length < 2) return null;
  if (error) {
    const code = readErrorCode(error);
    const msg = (code && SEARCH_ERROR_COPY[code]) || 'Search hit a snag. Try again in a sec.';
    return <p className="text-destructive text-caption px-1 py-2">{msg}</p>;
  }
  if (loading && results.length === 0) {
    return <p className="text-ink-muted text-caption px-1 py-2">Searching…</p>;
  }
  if (results.length === 0) {
    return <p className="text-ink-muted text-caption px-1 py-2">No results.</p>;
  }
  return (
    <ul className="border-glass-border flex max-h-[260px] flex-col gap-1 overflow-y-auto rounded-md border p-1">
      {results.map((row) => (
        <li key={row.videoId}>
          <button
            type="button"
            onClick={() => onPick(row)}
            className="hover:bg-glass-hover flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
          >
            <img
              src={row.thumbnailUrl}
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 rounded object-cover"
            />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-ink text-control truncate font-medium">{row.title}</span>
              <span className="text-ink-muted text-caption truncate">{row.artist}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
