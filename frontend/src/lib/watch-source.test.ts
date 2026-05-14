import { describe, expect, it } from 'vitest';

import { describeSource, detectWatchSource } from './watch-source';

describe('detectWatchSource', () => {
  it('extracts ids from canonical youtube watch URLs', () => {
    const result = detectWatchSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toEqual({
      kind: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      providerId: 'dQw4w9WgXcQ',
    });
  });

  it('extracts ids from youtu.be shortlinks', () => {
    const result = detectWatchSource('https://youtu.be/dQw4w9WgXcQ');
    expect(result?.kind).toBe('youtube');
    expect(result?.providerId).toBe('dQw4w9WgXcQ');
  });

  it('extracts ids from /shorts/ URLs', () => {
    const result = detectWatchSource('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(result?.kind).toBe('youtube');
    expect(result?.providerId).toBe('dQw4w9WgXcQ');
  });

  it('extracts ids from /embed/ URLs', () => {
    const result = detectWatchSource('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(result?.kind).toBe('youtube');
    expect(result?.providerId).toBe('dQw4w9WgXcQ');
  });

  it('detects direct mp4 URLs', () => {
    const result = detectWatchSource('https://example.com/path/movie.mp4');
    expect(result).toEqual({
      kind: 'direct',
      url: 'https://example.com/path/movie.mp4',
      providerId: null,
    });
  });

  it('detects webm with query strings', () => {
    const result = detectWatchSource('https://cdn.example.com/clip.webm?sig=abc');
    expect(result?.kind).toBe('direct');
  });

  it('rejects non-http(s) protocols', () => {
    expect(detectWatchSource('file:///home/me/video.mp4')).toBeNull();
    expect(detectWatchSource('javascript:alert(1)')).toBeNull();
  });

  it('rejects unsupported hosts and extensions', () => {
    expect(detectWatchSource('https://example.com/article')).toBeNull();
    expect(detectWatchSource('https://netflix.com/watch/123')).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(detectWatchSource('')).toBeNull();
    expect(detectWatchSource('not a url')).toBeNull();
    expect(detectWatchSource('https://youtu.be/')).toBeNull();
    expect(detectWatchSource('https://youtube.com/watch?v=short')).toBeNull();
  });
});

describe('describeSource', () => {
  it('labels screen-share', () => {
    expect(describeSource({ kind: 'screen', url: 'livekit:screen-share' })).toBe('Shared screen');
  });

  it('labels youtube with the host', () => {
    expect(
      describeSource({ kind: 'youtube', url: 'https://www.youtube.com/watch?v=abc' }),
    ).toContain('YouTube');
  });

  it('falls back to hostname for direct URLs', () => {
    expect(describeSource({ kind: 'direct', url: 'https://cdn.example.com/clip.mp4' })).toBe(
      'cdn.example.com',
    );
  });

  it('returns the raw url when parsing fails', () => {
    expect(describeSource({ kind: 'direct', url: 'not-a-url' })).toBe('not-a-url');
  });
});
