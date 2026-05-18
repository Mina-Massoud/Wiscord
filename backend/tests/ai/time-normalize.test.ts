import { describe, expect, test } from 'vitest';

import { formatInZone, normalizeLocalIso } from '../../src/modules/ai/time-normalize.js';

describe('normalizeLocalIso — passthrough', () => {
  test('preserves a Z-suffixed UTC string', () => {
    const input = '2026-05-17T22:00:00Z';
    expect(normalizeLocalIso(input, 'America/New_York')).toBe(input);
  });

  test('preserves an offset-aware ISO with +HH:MM', () => {
    const input = '2026-05-17T18:00:00+05:30';
    expect(normalizeLocalIso(input, 'America/New_York')).toBe(input);
  });

  test('preserves an offset-aware ISO with -HHMM (no colon)', () => {
    const input = '2026-05-17T18:00:00-0400';
    expect(normalizeLocalIso(input, 'America/New_York')).toBe(input);
  });

  test('returns naive input unchanged when timezone is missing', () => {
    const input = '2026-05-17T18:00:00';
    expect(normalizeLocalIso(input, undefined)).toBe(input);
  });

  test('returns naive input unchanged when timezone is invalid', () => {
    const input = '2026-05-17T18:00:00';
    expect(normalizeLocalIso(input, 'Mars/Olympus')).toBe(input);
  });
});

describe('normalizeLocalIso — naive + IANA zone splices the correct offset', () => {
  test('America/New_York in May is DST (-04:00)', () => {
    // 2026-05-17 — well past spring-forward (2026-03-08).
    expect(normalizeLocalIso('2026-05-17T18:00:00', 'America/New_York')).toBe(
      '2026-05-17T18:00:00-04:00',
    );
  });

  test('America/New_York in January is EST (-05:00)', () => {
    expect(normalizeLocalIso('2026-01-15T18:00:00', 'America/New_York')).toBe(
      '2026-01-15T18:00:00-05:00',
    );
  });

  test('Asia/Tokyo is always +09:00 (no DST)', () => {
    expect(normalizeLocalIso('2026-05-17T18:00:00', 'Asia/Tokyo')).toBe(
      '2026-05-17T18:00:00+09:00',
    );
  });

  test('UTC zone yields +00:00 offset', () => {
    expect(normalizeLocalIso('2026-05-17T18:00:00', 'UTC')).toBe('2026-05-17T18:00:00+00:00');
  });

  test('zero-second form gets normalized with second precision', () => {
    expect(normalizeLocalIso('2026-05-17T18:00', 'America/New_York')).toBe(
      '2026-05-17T18:00:00-04:00',
    );
  });

  test('millisecond precision is preserved', () => {
    expect(normalizeLocalIso('2026-05-17T18:00:00.250', 'America/New_York')).toBe(
      '2026-05-17T18:00:00.250-04:00',
    );
  });

  test('Australia/Adelaide in May is +09:30 (half-hour zone)', () => {
    // Australia is in standard time in May (their DST runs Apr→Oct).
    expect(normalizeLocalIso('2026-05-17T09:00:00', 'Australia/Adelaide')).toBe(
      '2026-05-17T09:00:00+09:30',
    );
  });
});

describe('normalizeLocalIso — regression: "another one at 6pm" bug', () => {
  test('user in EDT says 6pm → wall clock is 18:00, stored UTC is 22:00', () => {
    const normalized = normalizeLocalIso('2026-05-17T18:00:00', 'America/New_York');
    expect(normalized).toBe('2026-05-17T18:00:00-04:00');
    // JS Date parses the offset-aware string to the correct UTC instant.
    expect(new Date(normalized).toISOString()).toBe('2026-05-17T22:00:00.000Z');
  });
});

describe('formatInZone', () => {
  test('renders a UTC instant in the named zone with offset', () => {
    const d = new Date('2026-05-17T22:00:00.000Z');
    expect(formatInZone(d, 'America/New_York')).toBe('2026-05-17T18:00:00-04:00');
  });

  test('renders the same instant correctly in a half-hour zone', () => {
    const d = new Date('2026-05-17T22:00:00.000Z');
    expect(formatInZone(d, 'Asia/Kolkata')).toBe('2026-05-18T03:30:00+05:30');
  });

  test('falls back to ISO Z when timezone is missing', () => {
    const d = new Date('2026-05-17T22:00:00.000Z');
    expect(formatInZone(d, undefined)).toBe('2026-05-17T22:00:00.000Z');
  });

  test('falls back to ISO Z when timezone is invalid', () => {
    const d = new Date('2026-05-17T22:00:00.000Z');
    expect(formatInZone(d, 'Not/A_Zone')).toBe('2026-05-17T22:00:00.000Z');
  });
});
