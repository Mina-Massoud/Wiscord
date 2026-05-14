import { describe, expect, it } from 'vitest';

import { groupByRecency } from './recency';

interface Doc {
  id: string;
  updatedAt: string;
}

// Anchor at local-noon on May 14, 2026 so all relative dates below
// stay unambiguous across machine timezones. `groupByRecency` uses the
// caller's local "now" for bucket boundaries, so the test does too.
const anchor = new Date(2026, 4, 14, 12, 0, 0, 0);

function makeDoc(id: string, date: Date): Doc {
  return { id, updatedAt: date.toISOString() };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('groupByRecency', () => {
  it('buckets items into Today / Yesterday / This week / Older', () => {
    const docs: Doc[] = [
      makeDoc('today', new Date(2026, 4, 14, 9, 0, 0)),
      makeDoc('yesterday', new Date(2026, 4, 13, 22, 0, 0)),
      makeDoc('thisWeek', new Date(2026, 4, 10, 10, 0, 0)),
      makeDoc('older', new Date(anchor.getTime() - 60 * DAY_MS)),
    ];

    const groups = groupByRecency(docs, (d) => d.updatedAt, anchor);

    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'This week', 'Older']);
    expect(groups[0].items.map((d) => d.id)).toEqual(['today']);
    expect(groups[1].items.map((d) => d.id)).toEqual(['yesterday']);
    expect(groups[2].items.map((d) => d.id)).toEqual(['thisWeek']);
    expect(groups[3].items.map((d) => d.id)).toEqual(['older']);
  });

  it('drops empty buckets so consumers never render a blank section', () => {
    const docs: Doc[] = [makeDoc('today', new Date(2026, 4, 14, 9, 0, 0))];
    const groups = groupByRecency(docs, (d) => d.updatedAt, anchor);

    expect(groups.map((g) => g.label)).toEqual(['Today']);
  });

  it('sorts each bucket newest first', () => {
    const docs: Doc[] = [
      makeDoc('earlierToday', new Date(2026, 4, 14, 1, 0, 0)),
      makeDoc('laterToday', new Date(2026, 4, 14, 11, 0, 0)),
    ];
    const groups = groupByRecency(docs, (d) => d.updatedAt, anchor);

    expect(groups[0].items.map((d) => d.id)).toEqual(['laterToday', 'earlierToday']);
  });

  it('treats unparseable updatedAt as Older instead of throwing', () => {
    const docs: Doc[] = [{ id: 'broken', updatedAt: 'not-a-date' }];
    const groups = groupByRecency(docs, (d) => d.updatedAt, anchor);

    expect(groups).toEqual([{ label: 'Older', items: [docs[0]] }]);
  });

  it('returns an empty array when nothing to bucket', () => {
    expect(groupByRecency<Doc>([], (d) => d.updatedAt, anchor)).toEqual([]);
  });
});
