import { describe, expect, test } from 'vitest';

import {
  categoryListQuery,
  createCategoryBody,
  createEventBody,
  eventRangeQuery,
  updateCategoryBody,
  updateEventBody,
} from '../../src/modules/calendar/schemas.js';
import { CALENDAR_BUILTIN_CATEGORIES } from '../../src/modules/calendar/category-defaults.js';
import { expandOccurrences } from '../../src/modules/calendar/event-service.js';
import { CALENDAR_CATEGORY_COLOR_SLUGS } from '../../src/db/models/CalendarCategory.js';

const VALID_OBJECT_ID = 'a'.repeat(24);
const VALID_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('eventRangeQuery', () => {
  test('accepts a valid window', () => {
    const parsed = eventRangeQuery.parse({
      from: '2026-05-01T00:00:00Z',
      to: '2026-05-31T23:59:59Z',
    });
    expect(parsed.from).toBe('2026-05-01T00:00:00Z');
    expect(parsed.channelId).toBeUndefined();
  });

  test('rejects a window where from >= to', () => {
    expect(() =>
      eventRangeQuery.parse({
        from: '2026-05-31T00:00:00Z',
        to: '2026-05-01T00:00:00Z',
      }),
    ).toThrow();
  });

  test('rejects a non-UUID channelId', () => {
    expect(() =>
      eventRangeQuery.parse({
        from: '2026-05-01T00:00:00Z',
        to: '2026-05-31T00:00:00Z',
        channelId: 'not-a-uuid',
      }),
    ).toThrow();
  });
});

describe('createEventBody', () => {
  test('defaults personal scope when channelId is omitted', () => {
    const parsed = createEventBody.parse({
      categoryId: VALID_OBJECT_ID,
      title: 'CS Lecture',
      startAt: '2026-05-14T10:00:00Z',
      endAt: '2026-05-14T11:00:00Z',
    });
    expect(parsed.channelId).toBeNull();
    expect(parsed.allDay).toBe(false);
    expect(parsed.recurrence).toEqual({ freq: 'none', count: 1 });
  });

  test('rejects an event whose endAt is before startAt', () => {
    expect(() =>
      createEventBody.parse({
        categoryId: VALID_OBJECT_ID,
        title: 'Bad event',
        startAt: '2026-05-14T11:00:00Z',
        endAt: '2026-05-14T10:00:00Z',
      }),
    ).toThrow();
  });

  test('rejects an invalid categoryId', () => {
    expect(() =>
      createEventBody.parse({
        categoryId: 'not-an-object-id',
        title: 'Bad cat id',
        startAt: '2026-05-14T10:00:00Z',
        endAt: '2026-05-14T11:00:00Z',
      }),
    ).toThrow();
  });

  test('rejects an empty title', () => {
    expect(() =>
      createEventBody.parse({
        categoryId: VALID_OBJECT_ID,
        title: '   ',
        startAt: '2026-05-14T10:00:00Z',
        endAt: '2026-05-14T11:00:00Z',
      }),
    ).toThrow();
  });
});

describe('updateEventBody', () => {
  test('allows a single-field patch', () => {
    const parsed = updateEventBody.parse({ title: 'Renamed' });
    expect(parsed.title).toBe('Renamed');
  });

  test('rejects a patch that moves startAt past endAt', () => {
    expect(() =>
      updateEventBody.parse({
        startAt: '2026-05-14T12:00:00Z',
        endAt: '2026-05-14T11:00:00Z',
      }),
    ).toThrow();
  });
});

describe('createCategoryBody', () => {
  test('accepts every supported color slug', () => {
    for (const color of CALENDAR_CATEGORY_COLOR_SLUGS) {
      const parsed = createCategoryBody.parse({
        scope: 'user',
        name: 'Lab work',
        color,
      });
      expect(parsed.color).toBe(color);
    }
  });

  test('rejects an unknown color', () => {
    expect(() =>
      createCategoryBody.parse({ scope: 'user', name: 'Lab', color: 'magenta' }),
    ).toThrow();
  });
});

describe('updateCategoryBody', () => {
  test('rejects an empty patch', () => {
    expect(() => updateCategoryBody.parse({})).toThrow();
  });
});

describe('categoryListQuery', () => {
  test('parses channel scope with a channelId', () => {
    const parsed = categoryListQuery.parse({ scope: 'channel', channelId: VALID_UUID });
    expect(parsed.scope).toBe('channel');
  });
});

describe('CALENDAR_BUILTIN_CATEGORIES', () => {
  test('ships exactly six study-domain defaults', () => {
    expect(CALENDAR_BUILTIN_CATEGORIES.map((c) => c.slug)).toEqual([
      'class',
      'exam',
      'study',
      'assignment',
      'project',
      'break',
    ]);
  });

  test('every builtin color is in the supported palette', () => {
    for (const b of CALENDAR_BUILTIN_CATEGORIES) {
      expect(CALENDAR_CATEGORY_COLOR_SLUGS).toContain(b.color);
    }
  });
});

describe('expandOccurrences', () => {
  // Minimal mock matching the fields `expandOccurrences` reads. The real fn
  // is type-anchored to CalendarEventDoc; we cast through unknown so the test
  // can stay pure (no Mongoose connection required).
  function makeDoc(over: {
    startAt: Date;
    endAt: Date;
    freq: 'none' | 'weekly_n';
    count: number;
  }) {
    return {
      _id: 'master-id',
      userId: 'u1',
      channelId: null,
      categoryId: 'cat-id',
      title: 'Repeating study session',
      description: '',
      allDay: false,
      startAt: over.startAt,
      endAt: over.endAt,
      recurrence: { freq: over.freq, count: over.count },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    } as unknown as Parameters<typeof expandOccurrences>[0];
  }

  test('returns a single occurrence for non-recurring events', () => {
    const occurrences = expandOccurrences(
      makeDoc({
        startAt: new Date('2026-05-14T10:00:00Z'),
        endAt: new Date('2026-05-14T11:00:00Z'),
        freq: 'none',
        count: 1,
      }),
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-05-31T00:00:00Z'),
    );
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.isOccurrence).toBe(false);
  });

  test('expands weekly_n into the requested window only', () => {
    const occurrences = expandOccurrences(
      makeDoc({
        startAt: new Date('2026-05-04T10:00:00Z'),
        endAt: new Date('2026-05-04T11:00:00Z'),
        freq: 'weekly_n',
        count: 8,
      }),
      new Date('2026-05-10T00:00:00Z'),
      new Date('2026-05-31T00:00:00Z'),
    );
    // Window covers weeks 2..4 of the series (occurrences at idx 1, 2, 3).
    expect(occurrences.map((o) => o.occurrenceId)).toEqual([
      'master-id:1',
      'master-id:2',
      'master-id:3',
    ]);
    expect(occurrences.every((o) => o.isOccurrence)).toBe(true);
  });
});
