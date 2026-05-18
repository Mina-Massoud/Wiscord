import { describe, expect, test, vi } from 'vitest';

import { AppError } from '../../src/lib/errors.js';

/**
 * Service-layer tests exercise the scope dispatch + 503 fast-path.
 * Mongoose models + the Gemini SDK are mocked so the suite stays
 * pure — no DB, no network.
 */

vi.mock('../../src/modules/ai/provider/gemini-client.js', async () => {
  return {
    isAiConfigured: () => false,
    getGeminiClient: () => {
      throw new AppError(
        503,
        'ai_not_configured',
        'AI is not configured. Set GOOGLE_API_KEY in backend/.env to enable.',
      );
    },
    __resetGeminiClientForTests: () => undefined,
  };
});

vi.mock('../../src/modules/ai/context-builder.js', async () => ({
  buildPersonalContext: vi.fn(async () => ({
    system: 'sys',
    user: 'usr',
    sources: { notes: [], events: [], attempts: [], activities: [] },
  })),
  PERSONAL_LIMITS: { notes: 8, calendarEvents: 20, quizAttempts: 5, voiceActivities: 5 },
}));

import { ask } from '../../src/modules/ai/service.js';

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe('ask() scope dispatch', () => {
  test('personal scope throws ai_not_configured when key is absent', async () => {
    // The generator starts work synchronously up to the first yield —
    // getGeminiClient() runs inside askPersonal before any event is
    // emitted, so the thrown AppError surfaces on the first .next().
    await expect(
      (async () => {
        for await (const _ of ask({
          userId: 'user-1',
          scope: 'personal',
          question: 'hi',
        })) {
          // unreachable — the generator throws on first iteration
          void _;
        }
      })(),
    ).rejects.toMatchObject({ status: 503, code: 'ai_not_configured' });
  });

  test('channel scope rejects with scope_not_implemented', async () => {
    await expect(
      drain(ask({ userId: 'user-1', scope: 'channel', question: 'hi' })),
    ).rejects.toMatchObject({ status: 501, code: 'scope_not_implemented' });
  });

  test('server scope rejects with scope_not_implemented', async () => {
    await expect(
      drain(ask({ userId: 'user-1', scope: 'server', question: 'hi' })),
    ).rejects.toMatchObject({ status: 501, code: 'scope_not_implemented' });
  });

  test('voice scope rejects with scope_not_implemented', async () => {
    await expect(
      drain(ask({ userId: 'user-1', scope: 'voice', question: 'hi' })),
    ).rejects.toMatchObject({ status: 501, code: 'scope_not_implemented' });
  });
});
