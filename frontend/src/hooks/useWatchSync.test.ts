import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { computeExpectedMs } from './useWatchSync';
import type { WatchActivitySnapshot } from '@/queries/client';

const FIXED_NOW = new Date('2026-05-14T10:00:10Z').getTime();

function makeParty(overrides: Partial<WatchActivitySnapshot> = {}): WatchActivitySnapshot {
  return {
    channelId: '11111111-1111-1111-1111-111111111111',
    kind: 'youtube',
    hostUserId: 'host',
    source: { kind: 'youtube', url: 'https://youtu.be/abcdefghijk', title: null },
    state: 'playing',
    currentTimeMs: 30_000,
    lastTickAt: '2026-05-14T10:00:00Z',
    startedAt: '2026-05-14T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('computeExpectedMs', () => {
  it('projects the playhead forward while playing', () => {
    // lastTickAt is 10s before "now", so 30s + 10s = 40s
    expect(computeExpectedMs(makeParty())).toBe(40_000);
  });

  it('freezes the playhead when paused', () => {
    expect(computeExpectedMs(makeParty({ state: 'paused' }))).toBe(30_000);
  });

  it('freezes the playhead when idle', () => {
    expect(computeExpectedMs(makeParty({ state: 'idle' }))).toBe(30_000);
  });

  it('clamps to zero when viewer clock is ahead of the server', () => {
    // lastTickAt = now + 5s — viewer clock ahead. Projection clamps to >= 0.
    const futureTick = new Date(FIXED_NOW + 5_000).toISOString();
    const party = makeParty({ currentTimeMs: 30_000, lastTickAt: futureTick });
    // We expect at least `currentTimeMs`, never less.
    expect(computeExpectedMs(party)).toBeGreaterThanOrEqual(30_000);
  });
});
