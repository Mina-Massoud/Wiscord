import { useState } from 'react';
import { Search, X } from 'lucide-react';

import { useMusicPlayerStore } from '@/lib/music-player-store';
import { useMusicSearch } from '@/queries/music';

import { SearchResults } from './SearchResults';

/**
 * Search-first expanded view — shown when no track is loaded yet.
 * Picking a result fires `loadTrack`, which flips the capsule into
 * `expanded-now-playing` and morphs the shell at the parent level.
 */
export function ExpandedSearchSlot(): React.JSX.Element {
  const loadTrack = useMusicPlayerStore((s) => s.loadTrack);
  const collapseToBar = useMusicPlayerStore((s) => s.collapseToBar);

  const [search, setSearch] = useState('');
  const { data: results, isFetching, error: searchError } = useMusicSearch(search);

  return (
    <div className="flex h-full flex-col gap-2.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-ink-muted text-badge font-bold tracking-wider uppercase">
          Search music
        </span>
        <button
          type="button"
          onClick={collapseToBar}
          aria-label="Close"
          className="text-ink-muted hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="bg-glass-surface-2 border-glass-border flex items-center gap-2 rounded-full border px-4 py-2.5">
        <Search className="text-ink-muted size-4 shrink-0" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a song…"
          aria-label="Search music"
          className="text-ink text-control placeholder:text-ink-subtle w-full bg-transparent outline-none"
          autoFocus
        />
      </div>

      <SearchResults
        query={search}
        results={results ?? []}
        loading={isFetching}
        error={searchError}
        onPick={(picked) => {
          loadTrack(picked);
          setSearch('');
        }}
      />
    </div>
  );
}
