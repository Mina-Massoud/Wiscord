import { beforeEach, describe, expect, test } from 'vitest';

import { useMusicPlayerStore, hasTrack } from './music-player-store';
import type { MusicTrack } from '@/types/music';

const TRACK: MusicTrack = {
  videoId: 'abc123',
  title: 'Anti-Hero',
  artist: 'Taylor Swift',
  thumbnailUrl: 'https://example.com/cover.jpg',
  durationSeconds: 200,
};

beforeEach(() => {
  useMusicPlayerStore.setState({
    view: 'idle',
    track: null,
    isPlaying: false,
    progressMs: 0,
    durationMs: 0,
    pendingSeekMs: null,
    localMuted: false,
  });
});

describe('music-player-store', () => {
  test('starts idle with no track', () => {
    const state = useMusicPlayerStore.getState();
    expect(state.view).toBe('idle');
    expect(state.track).toBeNull();
    expect(hasTrack(state)).toBe(false);
  });

  test('loadTrack sets track + isPlaying + view=expanded + seeds duration', () => {
    useMusicPlayerStore.getState().loadTrack(TRACK);
    const s = useMusicPlayerStore.getState();
    expect(s.track).toEqual(TRACK);
    expect(s.isPlaying).toBe(true);
    expect(s.view).toBe('expanded');
    expect(s.durationMs).toBe(200_000);
    expect(s.progressMs).toBe(0);
  });

  test('loadTrack with autoplay:false leaves isPlaying false', () => {
    useMusicPlayerStore.getState().loadTrack(TRACK, { autoplay: false });
    const s = useMusicPlayerStore.getState();
    expect(s.track).toEqual(TRACK);
    expect(s.isPlaying).toBe(false);
    expect(s.view).toBe('expanded');
    expect(s.progressMs).toBe(0);
  });

  test('loadTrack with autoplay:true matches default behavior', () => {
    useMusicPlayerStore.getState().loadTrack(TRACK, { autoplay: true });
    expect(useMusicPlayerStore.getState().isPlaying).toBe(true);
  });

  test('collapseToBar goes to bar when track exists', () => {
    useMusicPlayerStore.getState().loadTrack(TRACK);
    useMusicPlayerStore.getState().collapseToBar();
    expect(useMusicPlayerStore.getState().view).toBe('bar');
  });

  test('collapseToBar goes to idle when no track', () => {
    useMusicPlayerStore.getState().openExpanded();
    expect(useMusicPlayerStore.getState().view).toBe('expanded');
    useMusicPlayerStore.getState().collapseToBar();
    expect(useMusicPlayerStore.getState().view).toBe('idle');
  });

  test('togglePlay flips isPlaying', () => {
    useMusicPlayerStore.getState().loadTrack(TRACK);
    expect(useMusicPlayerStore.getState().isPlaying).toBe(true);
    useMusicPlayerStore.getState().togglePlay();
    expect(useMusicPlayerStore.getState().isPlaying).toBe(false);
    useMusicPlayerStore.getState().togglePlay();
    expect(useMusicPlayerStore.getState().isPlaying).toBe(true);
  });

  test('seek stores a pending request, clearPendingSeek consumes it', () => {
    useMusicPlayerStore.getState().seek(45_000);
    expect(useMusicPlayerStore.getState().pendingSeekMs).toBe(45_000);
    useMusicPlayerStore.getState().clearPendingSeek();
    expect(useMusicPlayerStore.getState().pendingSeekMs).toBeNull();
  });

  test('seek clamps negative values to 0', () => {
    useMusicPlayerStore.getState().seek(-50);
    expect(useMusicPlayerStore.getState().pendingSeekMs).toBe(0);
  });

  test('toggleLocalMute flips localMuted', () => {
    expect(useMusicPlayerStore.getState().localMuted).toBe(false);
    useMusicPlayerStore.getState().toggleLocalMute();
    expect(useMusicPlayerStore.getState().localMuted).toBe(true);
    useMusicPlayerStore.getState().toggleLocalMute();
    expect(useMusicPlayerStore.getState().localMuted).toBe(false);
  });

  test('engine-side setters update store fields', () => {
    useMusicPlayerStore.getState().setPlaying(true);
    useMusicPlayerStore.getState().setProgress(12_345);
    useMusicPlayerStore.getState().setDuration(180_000);
    const s = useMusicPlayerStore.getState();
    expect(s.isPlaying).toBe(true);
    expect(s.progressMs).toBe(12_345);
    expect(s.durationMs).toBe(180_000);
  });
});
