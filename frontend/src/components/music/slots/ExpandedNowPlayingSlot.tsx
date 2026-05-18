import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, Search, SkipBack, SkipForward, X } from 'lucide-react';

import { useMusicPlayerStore } from '@/lib/music-player-store';
import { useMusicSearch } from '@/queries/music';
import type { MusicTrack } from '@/types/music';

import { MusicWaveform } from '../MusicWaveform';
import { SearchResults } from './SearchResults';
import { Scrubber } from './Scrubber';

interface ExpandedNowPlayingSlotProps {
  track: MusicTrack;
  /** Optional header chrome (e.g. share-popover trigger from ShareMusicPopover). */
  headerActions?: React.ReactNode;
}

/**
 * Now-playing card — cover, scrubber, transport, optional inline search.
 * The shell morphs to this shape when a track loads. Audio keeps playing
 * the whole time the inline search is open — the player store isn't
 * touched until the user picks a new song.
 */
export function ExpandedNowPlayingSlot({
  track,
  headerActions,
}: ExpandedNowPlayingSlotProps): React.JSX.Element {
  const isPlaying = useMusicPlayerStore((s) => s.isPlaying);
  const progressMs = useMusicPlayerStore((s) => s.progressMs);
  const durationMs = useMusicPlayerStore((s) => s.durationMs);
  const togglePlay = useMusicPlayerStore((s) => s.togglePlay);
  const seek = useMusicPlayerStore((s) => s.seek);
  const loadTrack = useMusicPlayerStore((s) => s.loadTrack);
  const collapseToBar = useMusicPlayerStore((s) => s.collapseToBar);

  const [searchMode, setSearchMode] = useState(false);
  const [search, setSearch] = useState('');
  const { data: results, isFetching, error: searchError } = useMusicSearch(search);

  function exitSearch(): void {
    setSearchMode(false);
    setSearch('');
  }

  return (
    <div className="flex h-full flex-col gap-2.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-ink-muted text-badge font-bold tracking-wider uppercase">
          Now playing
        </span>
        <div className="flex items-center gap-2">
          {headerActions}
          {!searchMode ? (
            <button
              type="button"
              onClick={() => setSearchMode(true)}
              aria-label="Search music"
              className="text-ink-muted hover:text-ink"
            >
              <Search className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={collapseToBar}
            aria-label="Close"
            className="text-ink-muted hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!searchMode ? (
          <motion.div
            key="player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="flex min-h-0 flex-1 flex-col gap-2.5"
          >
            <div className="flex items-start gap-3">
              <img
                src={track.thumbnailUrl}
                alt=""
                width={68}
                height={68}
                className="border-glass-border size-[68px] shrink-0 rounded-md border object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-ink text-control min-w-0 truncate leading-tight font-semibold">
                    {track.title}
                  </span>
                  <MusicWaveform
                    active={isPlaying}
                    bars={5}
                    className="text-success h-[16px] w-[14px] shrink-0"
                  />
                </div>
                <span className="text-ink-muted text-caption truncate">{track.artist}</span>
              </div>
            </div>

            <Scrubber progressMs={progressMs} durationMs={durationMs} onSeek={seek} />

            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label="Previous track"
                disabled
                className="text-ink-muted disabled:opacity-30"
              >
                <SkipBack className="size-4" fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="bg-ink text-canvas hover:bg-ink/90 flex size-9 items-center justify-center rounded-full"
              >
                {isPlaying ? (
                  <Pause className="size-4" fill="currentColor" />
                ) : (
                  <Play className="size-4 translate-x-[1px]" fill="currentColor" />
                )}
              </button>
              <button
                type="button"
                aria-label="Next track"
                disabled
                className="text-ink-muted disabled:opacity-30"
              >
                <SkipForward className="size-4" fill="currentColor" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            <div className="bg-glass-surface-2 border-glass-border flex items-center gap-2 rounded-full border px-3 py-2">
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
              <button
                type="button"
                onClick={exitSearch}
                aria-label="Cancel search"
                className="text-ink-muted hover:text-ink shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <SearchResults
                query={search}
                results={results ?? []}
                loading={isFetching}
                error={searchError}
                onPick={(picked) => {
                  loadTrack(picked);
                  exitSearch();
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
