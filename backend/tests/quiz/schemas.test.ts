import { describe, expect, test } from 'vitest';

import {
  MAX_QUESTIONS_PER_QUIZ,
  updateQuizBody,
} from '../../src/modules/quiz/schemas.js';

/**
 * Lightweight schema-level test for the new 100-question ceiling.
 * The previous 50 cap was tied to hand-authored quizzes — once the AI
 * `generateExam` tool landed we need headroom for a real-sized final.
 */
describe('updateQuizBody question cap', () => {
  test('MAX_QUESTIONS_PER_QUIZ is 100', () => {
    expect(MAX_QUESTIONS_PER_QUIZ).toBe(100);
  });

  test('accepts exactly MAX_QUESTIONS_PER_QUIZ questions', () => {
    const questions = Array.from({ length: MAX_QUESTIONS_PER_QUIZ }, (_, i) => ({
      id: `q${i}`,
      type: 'true_false' as const,
      prompt: 'Sample',
      correct: true,
    }));
    expect(() => updateQuizBody.parse({ questions })).not.toThrow();
  });

  test('rejects one over the cap', () => {
    const questions = Array.from({ length: MAX_QUESTIONS_PER_QUIZ + 1 }, (_, i) => ({
      id: `q${i}`,
      type: 'true_false' as const,
      prompt: 'Sample',
      correct: true,
    }));
    expect(() => updateQuizBody.parse({ questions })).toThrow();
  });

  test('still rejects an empty patch', () => {
    expect(() => updateQuizBody.parse({})).toThrow();
  });
});
