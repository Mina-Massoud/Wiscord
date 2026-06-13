import { describe, expect, test } from 'vitest';

import {
  PresenceStore,
  type PresenceChange,
} from '../src/modules/presence/presence-store.js';
import { presenceQuery } from '../src/modules/presence/schemas.js';

const MINA = '1234567890abcdef12345678';
const SAM = 'fedcba0987654321fedcba09';

function track(store: PresenceStore): PresenceChange[] {
  const changes: PresenceChange[] = [];
  store.on('state_changed', (c) => changes.push(c));
  return changes;
}

describe('PresenceStore transitions', () => {
  test('first socket emits online; additional sockets do not re-emit', () => {
    const store = new PresenceStore();
    const changes = track(store);

    store.markOnline(MINA);
    store.markOnline(MINA); // second tab

    expect(changes).toEqual([{ userId: MINA, status: 'online' }]);
    expect(store.get(MINA)).toBe('online');
  });

  test('offline only emits when the last socket disconnects', () => {
    const store = new PresenceStore();
    store.markOnline(MINA);
    store.markOnline(MINA);
    const changes = track(store);

    store.markOffline(MINA); // one tab left — still online
    expect(changes).toHaveLength(0);
    expect(store.get(MINA)).toBe('online');

    store.markOffline(MINA); // last tab gone
    expect(changes).toEqual([{ userId: MINA, status: 'offline' }]);
    expect(store.get(MINA)).toBe('offline');
  });

  test('markOffline on an unknown user is a no-op', () => {
    const store = new PresenceStore();
    const changes = track(store);
    store.markOffline(SAM);
    expect(changes).toHaveLength(0);
    expect(store.get(SAM)).toBe('offline');
  });

  test('setIdle toggles online <-> idle and emits on change only', () => {
    const store = new PresenceStore();
    store.markOnline(MINA);
    const changes = track(store);

    store.setIdle(MINA, true);
    store.setIdle(MINA, true); // already idle — no emit
    store.setIdle(MINA, false);

    expect(changes).toEqual([
      { userId: MINA, status: 'idle' },
      { userId: MINA, status: 'online' },
    ]);
  });

  test('setIdle on an offline user is a no-op', () => {
    const store = new PresenceStore();
    const changes = track(store);
    store.setIdle(SAM, true);
    expect(changes).toHaveLength(0);
    expect(store.get(SAM)).toBe('offline');
  });

  test('snapshot returns offline for unknown ids and the live status otherwise', () => {
    const store = new PresenceStore();
    store.markOnline(MINA);
    expect(store.snapshot([MINA, SAM])).toEqual({ [MINA]: 'online', [SAM]: 'offline' });
  });
});

describe('presenceQuery schema', () => {
  test('splits, trims, and drops empty entries', () => {
    expect(presenceQuery.parse({ userIds: `${MINA}, ${SAM},` }).userIds).toEqual([MINA, SAM]);
  });

  test('rejects a non-ObjectId entry', () => {
    expect(() => presenceQuery.parse({ userIds: 'not-an-id' })).toThrow();
  });

  test('caps the batch at 200', () => {
    const tooMany = Array.from({ length: 201 }, () => MINA).join(',');
    expect(() => presenceQuery.parse({ userIds: tooMany })).toThrow();
  });
});
