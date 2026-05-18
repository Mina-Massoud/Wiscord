import { create } from 'zustand';

import type { MusicTrack } from '@/types/music';

/**
 * Music player state. Single source of truth for the music capsule and
 * the hidden YouTube iframe audio engine — they read+write through here
 * so the visible UI can morph without remounting the audio source.
 *
 * Capsule UI states map onto this store:
 *  - `view === 'idle'`     → no track ever loaded, show circular logo only
 *  - `view === 'bar'`      → a track is loaded; collapsed waveform + title
 *  - `view === 'expanded'` → user opened the card; cover, scrubber, search
 *
 * The hidden engine drives `progressMs`, `durationMs`, and `isPlaying`
 * from YouTube's iframe events. The UI requests transitions through
 * `loadTrack`, `togglePlay`, `seek`. The engine reads those and pokes
 * the iframe player.
 */

export type MusicCapsuleView = 'idle' | 'bar' | 'expanded';

interface MusicPlayerState {
  /** Which UI state the capsule is rendering. */
  view: MusicCapsuleView;
  /** Currently loaded track. null until the user picks one. */
  track: MusicTrack | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  /**
   * Local-only mute flag. Listen-together viewer can silence their iframe
   * without affecting the host's transport — the iframe keeps decoding
   * audio (so we stay in sync) but emits no sound. Default false; flips
   * back automatically on session end.
   */
  localMuted: boolean;

  // ── Actions: UI → store ────────────────────────────────────────────────
  setView: (view: MusicCapsuleView) => void;
  openExpanded: () => void;
  collapseToBar: () => void;
  /**
   * Load a track into the player. Defaults to autoplay so a user picking a
   * search result hears it immediately. The listen-together viewer bootstrap
   * passes `{ autoplay: false }` because the host drives transport — the
   * viewer waits for the host's first `play` event before sound starts.
   */
  loadTrack: (track: MusicTrack, opts?: { autoplay?: boolean }) => void;
  togglePlay: () => void;
  /** Seek request from the UI — engine reads `requestedSeekMs` and acts. */
  seek: (ms: number) => void;

  /** Toggle the local-mute flag. UI action; engine reads + applies. */
  toggleLocalMute: () => void;

  // ── Actions: engine → store ────────────────────────────────────────────
  setPlaying: (playing: boolean) => void;
  setProgress: (ms: number) => void;
  setDuration: (ms: number) => void;
  /** Engine signals it has consumed the pending seek request. */
  clearPendingSeek: () => void;

  /**
   * Pending one-shot seek request (ms). The engine watches this and seeks
   * the iframe; resets to null once consumed. We use a one-shot field
   * rather than a callback so the store stays serializable for tests.
   */
  pendingSeekMs: number | null;
}

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  view: 'idle',
  track: null,
  isPlaying: false,
  progressMs: 0,
  durationMs: 0,
  pendingSeekMs: null,
  localMuted: false,

  setView: (view) => set({ view }),
  openExpanded: () => set({ view: 'expanded' }),
  collapseToBar: () => {
    // If no track is loaded yet, expanded → idle (back to logo only).
    // Otherwise expanded → bar (track keeps playing in the background).
    const { track } = get();
    set({ view: track ? 'bar' : 'idle' });
  },

  loadTrack: (track, opts) =>
    set({
      track,
      progressMs: 0,
      durationMs: track.durationSeconds ? track.durationSeconds * 1000 : 0,
      isPlaying: opts?.autoplay ?? true,
      // Leave the user in the expanded card after picking a track so they
      // see the cover land — they can collapse to the bar themselves.
      view: 'expanded',
    }),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  seek: (ms) => set({ pendingSeekMs: Math.max(0, ms) }),
  toggleLocalMute: () => set((s) => ({ localMuted: !s.localMuted })),

  setPlaying: (playing) => set({ isPlaying: playing }),
  setProgress: (ms) => set({ progressMs: ms }),
  setDuration: (ms) => set({ durationMs: ms }),
  clearPendingSeek: () => set({ pendingSeekMs: null }),
}));

/** Helper — true when there's a real track loaded (vs. brand-new session). */
export function hasTrack(state: MusicPlayerState): boolean {
  return state.track !== null;
}
