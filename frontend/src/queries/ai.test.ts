import { describe, expect, test } from 'vitest';

import { filterCitedSources, type AiSource } from './ai';

const sources: AiSource[] = [
  { id: 'note:abc123', kind: 'note', label: 'Calc notes' },
  { id: 'note:def456', kind: 'note', label: 'IELTS draft' },
  { id: 'event:evt789', kind: 'event', label: 'Calc study' },
  { id: 'attempt:atp001', kind: 'attempt', label: 'Algo quiz' },
  { id: 'activity:c1', kind: 'activity', label: 'whiteboard' },
];

describe('filterCitedSources', () => {
  test('returns empty when the response has no citations', () => {
    expect(filterCitedSources(sources, 'no citations here')).toEqual([]);
  });

  test('returns only the cited subset, preserving label order from sources', () => {
    const reply = 'check [note:abc123] and [event:evt789] before the deadline';
    const cited = filterCitedSources(sources, reply);
    expect(cited.map((s) => s.id)).toEqual(['note:abc123', 'event:evt789']);
  });

  test('deduplicates a source cited multiple times', () => {
    const reply = '[note:abc123] [note:abc123] [note:abc123]';
    const cited = filterCitedSources(sources, reply);
    expect(cited).toEqual([{ id: 'note:abc123', kind: 'note', label: 'Calc notes' }]);
  });

  test('ignores citations whose ids are not in the source list', () => {
    const reply = '[note:zzzz999] mentions something we did not retrieve';
    expect(filterCitedSources(sources, reply)).toEqual([]);
  });

  test('matches across all four kinds', () => {
    const reply = 'see [note:def456], [event:evt789], [attempt:atp001], and [activity:c1] together';
    const cited = filterCitedSources(sources, reply);
    expect(cited.map((s) => s.id).sort()).toEqual(
      ['activity:c1', 'attempt:atp001', 'event:evt789', 'note:def456'].sort(),
    );
  });

  test('regex is lenient on id charset (slugs, UUIDs, ObjectIds)', () => {
    const wideSources: AiSource[] = [
      { id: 'event:6651a2-cafe', kind: 'event', label: 'with-hyphen' },
      { id: 'attempt:64a8b2c1d3e4f5a6b7c8d9e0', kind: 'attempt', label: 'object-id' },
    ];
    const reply = '[event:6651a2-cafe] and [attempt:64a8b2c1d3e4f5a6b7c8d9e0] both';
    const cited = filterCitedSources(wideSources, reply);
    expect(cited.length).toBe(2);
  });
});
