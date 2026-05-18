import { describe, expect, test } from 'vitest';

import {
  saveSnapshotBody as wbSave,
  snapshotIdParam as wbParam,
} from '../src/modules/whiteboard/schemas.js';
import {
  saveSnapshotBody as notesSave,
  snapshotIdParam as notesParam,
} from '../src/modules/notes/schemas.js';
import { generateSnapshotTitle } from '../src/modules/whiteboard/snapshot-title.js';

const UUID = '11111111-1111-1111-1111-111111111111';
const OBJECT_ID = '1234567890abcdef12345678';

describe.each([
  ['whiteboard', wbSave, wbParam] as const,
  ['notes', notesSave, notesParam] as const,
])('snapshot schemas (%s)', (_label, saveBody, idParam) => {
  test('saveSnapshotBody accepts an explicit title', () => {
    expect(saveBody.parse({ title: 'Today only' }).title).toBe('Today only');
  });

  test('saveSnapshotBody accepts an empty body (server auto-titles)', () => {
    expect(saveBody.parse({}).title).toBeUndefined();
  });

  test('saveSnapshotBody rejects a title over the length cap', () => {
    expect(() => saveBody.parse({ title: 'x'.repeat(200) })).toThrow();
  });

  test('saveSnapshotBody trims whitespace before validating', () => {
    expect(saveBody.parse({ title: '  hello  ' }).title).toBe('hello');
  });

  test('snapshotIdParam accepts a valid pair', () => {
    expect(idParam.parse({ channelId: UUID, snapshotId: OBJECT_ID }).snapshotId).toBe(OBJECT_ID);
  });

  test('snapshotIdParam rejects a malformed ObjectId', () => {
    expect(() => idParam.parse({ channelId: UUID, snapshotId: 'not-an-id' })).toThrow();
  });
});

describe('generateSnapshotTitle', () => {
  test('produces a non-empty timestamp string', () => {
    const title = generateSnapshotTitle(UUID, new Date('2026-05-14T10:00:00Z'));
    expect(title).toContain('Snapshot');
  });

  test('different timestamps produce different titles', () => {
    const a = generateSnapshotTitle(UUID, new Date('2026-05-14T10:00:00Z'));
    const b = generateSnapshotTitle(UUID, new Date('2026-05-14T13:30:00Z'));
    expect(a).not.toBe(b);
  });
});
