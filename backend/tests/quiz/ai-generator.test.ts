import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Unit tests for the AI quiz generator. Gemini is mocked so the suite
 * is pure — no network, no API key needed. The mock returns whatever
 * JSON array we set via `setMockResponse(text)`; the generator parses
 * and validates it the same way it does in production.
 */

let mockResponses: string[] = [];
let callCount = 0;

vi.mock('../../src/modules/ai/provider/gemini-client.js', async () => ({
  isAiConfigured: () => true,
  getGeminiClient: () => ({
    models: {
      generateContent: vi.fn(async () => {
        const idx = Math.min(callCount, mockResponses.length - 1);
        callCount += 1;
        return { text: mockResponses[idx] ?? '[]' };
      }),
    },
  }),
  __resetGeminiClientForTests: () => undefined,
}));

import { generateQuizQuestions } from '../../src/modules/quiz/ai-generator.js';

function setMockResponses(...responses: string[]): void {
  mockResponses = responses;
  callCount = 0;
}

function makeMcqSingle(prompt: string, correctIndex = 0) {
  return {
    type: 'mcq_single',
    prompt,
    options: [
      { text: 'option a', isCorrect: correctIndex === 0 },
      { text: 'option b', isCorrect: correctIndex === 1 },
      { text: 'option c', isCorrect: correctIndex === 2 },
    ],
  };
}

beforeEach(() => {
  mockResponses = [];
  callCount = 0;
});

describe('generateQuizQuestions — happy path', () => {
  test('returns validated questions from a single call', async () => {
    setMockResponses(
      JSON.stringify([
        makeMcqSingle('q1'),
        makeMcqSingle('q2', 1),
        { type: 'true_false', prompt: 'q3', correct: true },
      ]),
    );
    const out = await generateQuizQuestions({
      topic: 'biology',
      questionCount: 3,
      types: ['mcq_single', 'true_false'],
    });
    expect(out).toHaveLength(3);
    expect(out[0]!.type).toBe('mcq_single');
    expect(out[2]!.type).toBe('true_false');
  });

  test('assigns ids server-side, not from the model', async () => {
    setMockResponses(
      JSON.stringify([
        { ...makeMcqSingle('q1'), id: 'model-supplied-id' },
      ]),
    );
    const out = await generateQuizQuestions({
      topic: 'topic',
      questionCount: 1,
      types: ['mcq_single'],
    });
    expect(out[0]!.id).not.toBe('model-supplied-id');
    expect(out[0]!.id.length).toBeGreaterThan(0);
  });

  test('short questions accept optional referenceAnswer', async () => {
    setMockResponses(
      JSON.stringify([
        { type: 'short', prompt: 'explain photosynthesis', referenceAnswer: 'sunlight + co2' },
      ]),
    );
    const out = await generateQuizQuestions({
      topic: 'biology',
      questionCount: 1,
      types: ['short'],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('short');
  });
});

describe('generateQuizQuestions — normalization', () => {
  test('mcq_single with zero correct options gets first marked correct', async () => {
    setMockResponses(
      JSON.stringify([
        {
          type: 'mcq_single',
          prompt: 'q',
          options: [
            { text: 'a', isCorrect: false },
            { text: 'b', isCorrect: false },
          ],
        },
      ]),
    );
    const out = await generateQuizQuestions({
      topic: 'topic',
      questionCount: 1,
      types: ['mcq_single'],
    });
    const first = out[0]!;
    expect(first.type).toBe('mcq_single');
    if (first.type !== 'mcq_single') throw new Error('type narrowing');
    expect(first.options.filter((o) => o.isCorrect)).toHaveLength(1);
  });

  test('mcq_single with multiple correct options keeps only the first', async () => {
    setMockResponses(
      JSON.stringify([
        {
          type: 'mcq_single',
          prompt: 'q',
          options: [
            { text: 'a', isCorrect: true },
            { text: 'b', isCorrect: true },
            { text: 'c', isCorrect: true },
          ],
        },
      ]),
    );
    const out = await generateQuizQuestions({
      topic: 'topic',
      questionCount: 1,
      types: ['mcq_single'],
    });
    const first = out[0]!;
    if (first.type !== 'mcq_single') throw new Error('type narrowing');
    expect(first.options.filter((o) => o.isCorrect)).toHaveLength(1);
  });

  test('mcq_multi with zero correct options gets first marked correct', async () => {
    setMockResponses(
      JSON.stringify([
        {
          type: 'mcq_multi',
          prompt: 'q',
          options: [
            { text: 'a', isCorrect: false },
            { text: 'b', isCorrect: false },
          ],
        },
      ]),
    );
    const out = await generateQuizQuestions({
      topic: 'topic',
      questionCount: 1,
      types: ['mcq_multi'],
    });
    const first = out[0]!;
    if (first.type !== 'mcq_multi') throw new Error('type narrowing');
    expect(first.options.some((o) => o.isCorrect)).toBe(true);
  });

  test('drops questions whose type is not in the allowed types', async () => {
    setMockResponses(
      JSON.stringify([
        {
          type: 'mcq_single',
          prompt: 'keep me',
          options: [
            { text: 'a', isCorrect: true },
            { text: 'b', isCorrect: false },
          ],
        },
        { type: 'short', prompt: 'drop me', referenceAnswer: 'ans' },
      ]),
    );
    const out = await generateQuizQuestions({
      topic: 'topic',
      questionCount: 1,
      types: ['mcq_single'],
    });
    expect(out).toHaveLength(1);
    expect(out.every((q) => q.type === 'mcq_single')).toBe(true);
  });

  test('drops questions with empty prompts', async () => {
    setMockResponses(
      JSON.stringify([
        { type: 'true_false', prompt: '', correct: true },
        { type: 'true_false', prompt: 'good prompt', correct: false },
        { type: 'true_false', prompt: 'another good one', correct: true },
      ]),
    );
    const out = await generateQuizQuestions({
      topic: 'topic',
      questionCount: 2,
      types: ['true_false'],
    });
    expect(out.every((q) => q.prompt.length > 0)).toBe(true);
  });
});

describe('generateQuizQuestions — batching', () => {
  test('splits a 30-question ask into two model calls', async () => {
    const batchOne = JSON.stringify(
      Array.from({ length: 25 }, (_, i) =>
        makeMcqSingle(`batch-1 q${i}`),
      ),
    );
    const batchTwo = JSON.stringify(
      Array.from({ length: 5 }, (_, i) =>
        makeMcqSingle(`batch-2 q${i}`),
      ),
    );
    setMockResponses(batchOne, batchTwo);
    const out = await generateQuizQuestions({
      topic: 'topic',
      questionCount: 30,
      types: ['mcq_single'],
    });
    expect(out).toHaveLength(30);
    expect(callCount).toBe(2);
  });
});

describe('generateQuizQuestions — failure modes', () => {
  test('rejects empty topic', async () => {
    await expect(
      generateQuizQuestions({ topic: '   ', questionCount: 5 }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_topic' });
  });

  test('rejects questionCount over the cap', async () => {
    await expect(
      generateQuizQuestions({ topic: 'topic', questionCount: 101 }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_question_count' });
  });

  test('rejects questionCount under 1', async () => {
    await expect(
      generateQuizQuestions({ topic: 'topic', questionCount: 0 }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_question_count' });
  });

  test('throws when the model returns no valid questions after retries', async () => {
    setMockResponses('[]', '[]', '[]');
    await expect(
      generateQuizQuestions({ topic: 'topic', questionCount: 5, types: ['mcq_single'] }),
    ).rejects.toMatchObject({ status: 502 });
  });

  test('throws on non-JSON model output', async () => {
    setMockResponses('not json at all');
    await expect(
      generateQuizQuestions({ topic: 'topic', questionCount: 5, types: ['mcq_single'] }),
    ).rejects.toMatchObject({ status: 502 });
  });
});
