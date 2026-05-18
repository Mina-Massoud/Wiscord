/**
 * Shared music types — step 2 of music across Wiscord. The widget reads
 * `MusicTrack` from the player store; search results land in the same
 * shape so picking a result hands the store a play-ready row.
 */

export interface MusicTrack {
  /** YouTube video id — the hidden iframe loads this directly. */
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  /** null until YouTube reports it via the iframe player. */
  durationSeconds: number | null;
}
