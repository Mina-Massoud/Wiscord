import { describe, expect, test } from 'vitest';

import { updateProfileBody } from '../../src/modules/auth/schemas.js';

describe('updateProfileBody — role + vibe', () => {
  test('accepts a role on its own', () => {
    expect(updateProfileBody.parse({ role: 'teacher' })).toEqual({ role: 'teacher' });
    expect(updateProfileBody.parse({ role: 'student' })).toEqual({ role: 'student' });
  });

  test('accepts a vibe on its own', () => {
    for (const vibe of ['genz', 'chill', 'professional'] as const) {
      expect(updateProfileBody.parse({ vibe })).toEqual({ vibe });
    }
  });

  test('accepts role + vibe together with other profile fields', () => {
    const parsed = updateProfileBody.parse({
      username: 'mina_42',
      display_name: 'Mina',
      role: 'teacher',
      vibe: 'professional',
    });
    expect(parsed.role).toBe('teacher');
    expect(parsed.vibe).toBe('professional');
  });

  test('rejects an unknown role', () => {
    expect(() => updateProfileBody.parse({ role: 'parent' })).toThrow();
  });

  test('rejects an unknown vibe', () => {
    expect(() => updateProfileBody.parse({ vibe: 'corpo' })).toThrow();
  });

  test('rejects the legacy `voice_style` field — strict schema means no silent accept', () => {
    // Strict mode in updateProfileBody catches stray fields so old
    // clients posting `voice_style` get a clear 400 instead of a
    // silently-ignored update.
    expect(() => updateProfileBody.parse({ voice_style: 'genz' })).toThrow();
  });

  test('empty patch is allowed (all fields optional)', () => {
    expect(updateProfileBody.parse({})).toEqual({});
  });
});
