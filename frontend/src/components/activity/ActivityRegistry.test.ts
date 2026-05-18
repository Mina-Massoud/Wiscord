import { describe, expect, it } from 'vitest';

import { ACTIVITY_REGISTRY, findActivity } from './ActivityRegistry';

describe('ActivityRegistry', () => {
  it('ships exactly six activities in the locked order', () => {
    expect(ACTIVITY_REGISTRY.map((a) => a.kind)).toEqual([
      'youtube',
      'screen-share',
      'notes',
      'whiteboard',
      'quiz',
      'pomodoro',
    ]);
  });

  it('every entry has a non-empty title and blurb', () => {
    for (const a of ACTIVITY_REGISTRY) {
      expect(a.title.trim().length).toBeGreaterThan(0);
      expect(a.blurb.trim().length).toBeGreaterThan(0);
    }
  });

  it('every entry has a cover gradient and a glyph', () => {
    for (const a of ACTIVITY_REGISTRY) {
      expect(a.cover.gradient).toMatch(/gradient/i);
      expect(typeof a.cover.glyph).toBe('object');
    }
  });

  it('findActivity returns the matching entry', () => {
    expect(findActivity('youtube')?.title).toBe('YouTube');
    expect(findActivity('notes')?.title).toBe('Notes');
    expect(findActivity('whiteboard')?.title).toBe('Whiteboard');
    expect(findActivity('screen-share')?.title).toBe('Screen share');
    expect(findActivity('quiz')?.title).toBe('Quiz');
    expect(findActivity('pomodoro')?.title).toBe('Focus session');
  });

  it('all activities are available in v1 — no coming-soon stubs shipped', () => {
    for (const a of ACTIVITY_REGISTRY) {
      expect(a.status).toBe('available');
    }
  });
});
