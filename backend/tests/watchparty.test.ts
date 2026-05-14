import { describe, expect, test } from 'vitest';

import {
  channelIdParam,
  controlBody,
  startPartyBody,
  transferHostBody,
} from '../src/modules/watchparty/schemas.js';

const VALID_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('channelIdParam', () => {
  test('accepts a valid UUID', () => {
    expect(channelIdParam.parse({ channelId: VALID_UUID }).channelId).toBe(VALID_UUID);
  });

  test('rejects a non-UUID', () => {
    expect(() => channelIdParam.parse({ channelId: 'not-a-uuid' })).toThrow();
  });
});

describe('startPartyBody', () => {
  test('accepts a YouTube URL with kind=youtube', () => {
    const parsed = startPartyBody.parse({
      source: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    expect(parsed.source.kind).toBe('youtube');
  });

  test('accepts a direct video URL', () => {
    const parsed = startPartyBody.parse({
      source: { kind: 'direct', url: 'https://cdn.example.com/clip.mp4', title: 'My clip' },
    });
    expect(parsed.source.title).toBe('My clip');
  });

  test('accepts the screen-share sentinel', () => {
    const parsed = startPartyBody.parse({
      source: { kind: 'screen', url: 'livekit:screen-share' },
    });
    expect(parsed.source.kind).toBe('screen');
  });

  test('rejects an invalid source kind', () => {
    expect(() =>
      startPartyBody.parse({ source: { kind: 'magnet', url: 'https://example.com/x.mp4' } }),
    ).toThrow();
  });

  test('rejects a malformed URL', () => {
    expect(() =>
      startPartyBody.parse({ source: { kind: 'direct', url: 'not a url' } }),
    ).toThrow();
  });

  test('rejects a URL over the length cap', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2100);
    expect(() => startPartyBody.parse({ source: { kind: 'direct', url: longUrl } })).toThrow();
  });
});

describe('controlBody', () => {
  test('accepts play/pause/seek with valid timeMs', () => {
    expect(controlBody.parse({ action: 'play', timeMs: 0 }).action).toBe('play');
    expect(controlBody.parse({ action: 'pause', timeMs: 5_000 }).timeMs).toBe(5_000);
    expect(controlBody.parse({ action: 'seek', timeMs: 60_000 }).action).toBe('seek');
  });

  test('rejects negative time', () => {
    expect(() => controlBody.parse({ action: 'play', timeMs: -1 })).toThrow();
  });

  test('rejects fractional time (must be integer ms)', () => {
    expect(() => controlBody.parse({ action: 'play', timeMs: 1.5 })).toThrow();
  });

  test('rejects an unknown action', () => {
    expect(() => controlBody.parse({ action: 'stop', timeMs: 0 })).toThrow();
  });

  test('rejects absurd time values', () => {
    expect(() => controlBody.parse({ action: 'play', timeMs: 99_999_999_999 })).toThrow();
  });
});

describe('transferHostBody', () => {
  test('accepts a target user id', () => {
    expect(transferHostBody.parse({ toUserId: 'user-1' }).toUserId).toBe('user-1');
  });

  test('rejects an empty id', () => {
    expect(() => transferHostBody.parse({ toUserId: '' })).toThrow();
  });
});
