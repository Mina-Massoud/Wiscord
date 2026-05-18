import { describe, expect, test } from 'vitest';

import {
  createCalendarEventArgs,
  deleteCalendarEventArgs,
  generateExamArgs,
  isDestructive,
  TOOL_NAMES,
  updateCalendarEventArgs,
  validateToolArgs,
} from '../../src/modules/ai/tool-runner.js';

describe('tool-runner schemas', () => {
  test('createCalendarEventArgs accepts a minimal valid payload', () => {
    const parsed = createCalendarEventArgs.parse({
      title: 'English exam',
      startAt: '2026-06-01T09:00:00.000Z',
      endAt: '2026-06-01T11:00:00.000Z',
    });
    expect(parsed.title).toBe('English exam');
    expect(parsed.description).toBeUndefined();
    expect(parsed.allDay).toBeUndefined();
  });

  test('createCalendarEventArgs rejects an empty title', () => {
    expect(() =>
      createCalendarEventArgs.parse({
        title: '   ',
        startAt: '2026-06-01T09:00:00.000Z',
        endAt: '2026-06-01T11:00:00.000Z',
      }),
    ).toThrow();
  });

  test('createCalendarEventArgs rejects non-ISO datetimes', () => {
    expect(() =>
      createCalendarEventArgs.parse({
        title: 'x',
        startAt: 'tomorrow',
        endAt: 'tomorrow afternoon',
      }),
    ).toThrow();
  });

  test('createCalendarEventArgs accepts naive ISO (server normalizes)', () => {
    const parsed = createCalendarEventArgs.parse({
      title: 'call mom',
      startAt: '2026-05-17T18:00:00',
      endAt: '2026-05-17T19:00:00',
    });
    expect(parsed.startAt).toBe('2026-05-17T18:00:00');
  });

  test('createCalendarEventArgs accepts offset-aware ISO', () => {
    const parsed = createCalendarEventArgs.parse({
      title: 'call mom',
      startAt: '2026-05-17T18:00:00-04:00',
      endAt: '2026-05-17T19:00:00-04:00',
    });
    expect(parsed.startAt).toBe('2026-05-17T18:00:00-04:00');
  });

  test('createCalendarEventArgs rejects malformed strings that Date.parse would accept', () => {
    expect(() =>
      createCalendarEventArgs.parse({
        title: 'x',
        startAt: '2026/05/17 18:00:00',
        endAt: '2026/05/17 19:00:00',
      }),
    ).toThrow();
    expect(() =>
      createCalendarEventArgs.parse({
        title: 'x',
        startAt: 'May 17 2026 6pm',
        endAt: 'May 17 2026 7pm',
      }),
    ).toThrow();
  });

  test('updateCalendarEventArgs only requires eventId', () => {
    const parsed = updateCalendarEventArgs.parse({ eventId: 'abc' });
    expect(parsed.eventId).toBe('abc');
  });

  test('deleteCalendarEventArgs requires eventId', () => {
    expect(() => deleteCalendarEventArgs.parse({})).toThrow();
    expect(deleteCalendarEventArgs.parse({ eventId: 'abc' }).eventId).toBe('abc');
  });
});

describe('tool destructive flag', () => {
  test('createCalendarEvent is not destructive', () => {
    expect(isDestructive('createCalendarEvent')).toBe(false);
  });
  test('updateCalendarEvent is destructive', () => {
    expect(isDestructive('updateCalendarEvent')).toBe(true);
  });
  test('deleteCalendarEvent is destructive', () => {
    expect(isDestructive('deleteCalendarEvent')).toBe(true);
  });
  test('createNote is not destructive', () => {
    expect(isDestructive('createNote')).toBe(false);
  });
  test('generateExam is destructive (user must preview the spec)', () => {
    expect(isDestructive('generateExam')).toBe(true);
  });
});

describe('generateExamArgs', () => {
  const validChannelId = '00000000-0000-4000-8000-000000000000';

  test('accepts a minimal valid payload', () => {
    const parsed = generateExamArgs.parse({
      channelId: validChannelId,
      title: 'Krebs cycle quiz',
      topic: 'Krebs cycle for intro biochem',
      questionCount: 10,
    });
    expect(parsed.channelId).toBe(validChannelId);
    expect(parsed.questionCount).toBe(10);
    expect(parsed.types).toBeUndefined();
  });

  test('accepts every legal type', () => {
    const parsed = generateExamArgs.parse({
      channelId: validChannelId,
      title: 't',
      topic: 'topic',
      questionCount: 5,
      types: ['mcq_single', 'mcq_multi', 'true_false', 'short'],
    });
    expect(parsed.types).toHaveLength(4);
  });

  test('rejects a non-UUID channelId', () => {
    expect(() =>
      generateExamArgs.parse({
        channelId: 'not-a-uuid',
        title: 't',
        topic: 'topic',
        questionCount: 5,
      }),
    ).toThrow();
  });

  test('rejects questionCount under 1', () => {
    expect(() =>
      generateExamArgs.parse({
        channelId: validChannelId,
        title: 't',
        topic: 'topic',
        questionCount: 0,
      }),
    ).toThrow();
  });

  test('rejects questionCount over 100', () => {
    expect(() =>
      generateExamArgs.parse({
        channelId: validChannelId,
        title: 't',
        topic: 'topic',
        questionCount: 101,
      }),
    ).toThrow();
  });

  test('rejects non-integer questionCount', () => {
    expect(() =>
      generateExamArgs.parse({
        channelId: validChannelId,
        title: 't',
        topic: 'topic',
        questionCount: 10.5,
      }),
    ).toThrow();
  });

  test('rejects empty topic', () => {
    expect(() =>
      generateExamArgs.parse({
        channelId: validChannelId,
        title: 't',
        topic: '',
        questionCount: 5,
      }),
    ).toThrow();
  });

  test('rejects source over the 10k cap', () => {
    expect(() =>
      generateExamArgs.parse({
        channelId: validChannelId,
        title: 't',
        topic: 'topic',
        questionCount: 5,
        source: 'x'.repeat(10_001),
      }),
    ).toThrow();
  });

  test('rejects an unknown question type', () => {
    expect(() =>
      generateExamArgs.parse({
        channelId: validChannelId,
        title: 't',
        topic: 'topic',
        questionCount: 5,
        types: ['mcq_single', 'essay' as 'short'],
      }),
    ).toThrow();
  });
});

describe('validateToolArgs', () => {
  test('throws AppError(400) on invalid args', () => {
    expect(() => validateToolArgs('createCalendarEvent', { title: '' })).toThrowError(
      expect.objectContaining({ status: 400, code: 'invalid_tool_args' }),
    );
  });

  test('returns the parsed payload on success', () => {
    const validated = validateToolArgs('deleteCalendarEvent', { eventId: 'abc' }) as {
      eventId: string;
    };
    expect(validated.eventId).toBe('abc');
  });

  test('TOOL_NAMES is the full set', () => {
    expect(TOOL_NAMES).toEqual([
      'createCalendarEvent',
      'updateCalendarEvent',
      'deleteCalendarEvent',
      'createNote',
      'generateExam',
    ]);
  });
});
