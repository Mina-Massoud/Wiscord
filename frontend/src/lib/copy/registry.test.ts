import { describe, expect, test } from 'vitest';

import type { Vibe } from '@/types/auth';
import { resolveCopy, type CopyKey } from './registry';

const ALL_VIBES: Vibe[] = ['genz', 'chill', 'professional'];

// Hand-picked sample of keys covering every section in the registry.
// If a section grows, add one key here so the section gets coverage.
const SAMPLE_KEYS: CopyKey[] = [
  'friends.title',
  'friends.empty.online.title',
  'friends.row.accept',
  'friends.toast.sent',
  'home.announcement.headline',
  'home.announcement.tagline',
  'home.spotlight.title',
  'home.spotlight.blurb',
  'voice.title',
  'voice.left.title',
  'voicePanel.connected.title',
];

describe('copy registry — vibe coverage', () => {
  test('every sample key resolves to a non-empty string in every vibe', () => {
    for (const key of SAMPLE_KEYS) {
      for (const vibe of ALL_VIBES) {
        const value = resolveCopy(key, vibe);
        expect(value, `${key} / ${vibe} should be non-empty`).toBeTruthy();
        expect(typeof value).toBe('string');
      }
    }
  });

  test('professional column never uses genz slang or emojis', () => {
    for (const key of SAMPLE_KEYS) {
      const value = resolveCopy(key, 'professional');
      expect(value, `${key} / professional should not contain 💀 or 🙏`).not.toMatch(/💀|🙏/);
      expect(value, `${key} / professional should not contain genz slang`).not.toMatch(
        /\b(bestie|lock(ed|ing)? in|lowkey|no cap|fr|bet\b|the gang|yapping|pull up)\b/i,
      );
    }
  });

  test('genz column keeps its character on at least some keys', () => {
    // Spot-check: at least one of these keys should still read genz.
    const samples = [
      resolveCopy('friends.title', 'genz'),
      resolveCopy('friends.add', 'genz'),
      resolveCopy('voice.idle.button', 'genz'),
    ];
    const joined = samples.join(' ');
    expect(joined).toMatch(/Gang|Bestie|Pull Up/);
  });
});
