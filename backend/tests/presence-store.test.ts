import { describe, expect, test } from 'vitest';

import {
  VoicePresenceStore,
  type VoiceStateChange,
} from '../src/modules/voice/presence-store.js';

const CHANNEL = '11111111-1111-1111-1111-111111111111';
const MINA = 'mina';
const SAM = 'sam';

function makeStore(): VoicePresenceStore {
  return new VoicePresenceStore();
}

describe('VoicePresenceStore.replace', () => {
  test('adds participants with null activityKind by default', () => {
    const store = makeStore();
    store.replace(CHANNEL, [{ identity: MINA, name: 'Mina', joinedAt: 1 }]);
    const rows = store.list(CHANNEL);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.activityKind).toBeNull();
  });

  test('preserves activityKind across a refresh', () => {
    const store = makeStore();
    store.replace(CHANNEL, [{ identity: MINA, name: 'Mina', joinedAt: 1 }]);
    store.setActivity(CHANNEL, MINA, 'whiteboard');
    // A LiveKit refresh tick that omits activityKind shouldn't wipe it.
    store.replace(CHANNEL, [{ identity: MINA, name: 'Mina', joinedAt: 1 }]);
    expect(store.list(CHANNEL)[0]?.activityKind).toBe('whiteboard');
  });

  test('drops activityKind for users that vanish', () => {
    const store = makeStore();
    store.replace(CHANNEL, [
      { identity: MINA, name: 'Mina', joinedAt: 1 },
      { identity: SAM, name: 'Sam', joinedAt: 2 },
    ]);
    store.setActivity(CHANNEL, MINA, 'notes');
    store.setActivity(CHANNEL, SAM, 'whiteboard');
    // Sam leaves the LiveKit room.
    store.replace(CHANNEL, [{ identity: MINA, name: 'Mina', joinedAt: 1 }]);
    const rows = store.list(CHANNEL);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identity).toBe(MINA);
    expect(rows[0]?.activityKind).toBe('notes');
  });
});

describe('VoicePresenceStore.setActivity', () => {
  test('returns false when the user is not in the channel', () => {
    const store = makeStore();
    expect(store.setActivity(CHANNEL, MINA, 'notes')).toBe(false);
  });

  test('returns false when the kind is unchanged', () => {
    const store = makeStore();
    store.replace(CHANNEL, [{ identity: MINA, name: 'Mina', joinedAt: 1 }]);
    store.setActivity(CHANNEL, MINA, 'notes');
    expect(store.setActivity(CHANNEL, MINA, 'notes')).toBe(false);
  });

  test('clears the kind back to null', () => {
    const store = makeStore();
    store.replace(CHANNEL, [{ identity: MINA, name: 'Mina', joinedAt: 1 }]);
    store.setActivity(CHANNEL, MINA, 'whiteboard');
    expect(store.setActivity(CHANNEL, MINA, null)).toBe(true);
    expect(store.list(CHANNEL)[0]?.activityKind).toBeNull();
  });

  test('emits state_changed on a real change', () => {
    const store = makeStore();
    store.replace(CHANNEL, [{ identity: MINA, name: 'Mina', joinedAt: 1 }]);
    let received: VoiceStateChange | null = null;
    store.on('state_changed', (change) => {
      received = change;
    });
    store.setActivity(CHANNEL, MINA, 'quiz');
    expect(received).not.toBeNull();
    const change = received as VoiceStateChange | null;
    expect(change?.channelId).toBe(CHANNEL);
    expect(change?.participants[0]?.activityKind).toBe('quiz');
  });
});

describe('VoicePresenceStore.remove', () => {
  test('removes the participant and drops their activityKind', () => {
    const store = makeStore();
    store.replace(CHANNEL, [
      { identity: MINA, name: 'Mina', joinedAt: 1 },
      { identity: SAM, name: 'Sam', joinedAt: 2 },
    ]);
    store.setActivity(CHANNEL, SAM, 'notes');
    expect(store.remove(CHANNEL, SAM)).toBe(true);
    const rows = store.list(CHANNEL);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identity).toBe(MINA);
  });
});
