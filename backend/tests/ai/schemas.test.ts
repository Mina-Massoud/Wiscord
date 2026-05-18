import { describe, expect, test } from 'vitest';

import { askBodySchema } from '../../src/modules/ai/schemas.js';

describe('askBodySchema', () => {
  test('accepts a minimal personal-scope question', () => {
    const parsed = askBodySchema.parse({ question: 'what am I working on today?' });
    expect(parsed.question).toBe('what am I working on today?');
    expect(parsed.scope).toBe('personal'); // default
    expect(parsed.scopeId).toBeUndefined();
  });

  test('accepts an explicit scope + scopeId', () => {
    const parsed = askBodySchema.parse({
      question: 'summarise the room',
      scope: 'channel',
      scopeId: 'channel-uuid',
    });
    expect(parsed.scope).toBe('channel');
    expect(parsed.scopeId).toBe('channel-uuid');
  });

  test('trims whitespace from the question', () => {
    expect(askBodySchema.parse({ question: '   hi  ' }).question).toBe('hi');
  });

  test('rejects an empty / whitespace-only question', () => {
    expect(() => askBodySchema.parse({ question: '' })).toThrow();
    expect(() => askBodySchema.parse({ question: '   ' })).toThrow();
  });

  test('rejects a question over 2000 characters', () => {
    expect(() => askBodySchema.parse({ question: 'a'.repeat(2001) })).toThrow();
  });

  test('rejects an unknown scope', () => {
    expect(() =>
      askBodySchema.parse({ question: 'hi', scope: 'galaxy' as unknown as 'personal' }),
    ).toThrow();
  });

  test('accepts every documented scope', () => {
    for (const scope of ['personal', 'channel', 'server', 'voice'] as const) {
      expect(askBodySchema.parse({ question: 'q', scope }).scope).toBe(scope);
    }
  });
});
