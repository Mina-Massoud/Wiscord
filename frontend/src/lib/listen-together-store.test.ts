import { beforeEach, describe, expect, test } from 'vitest';

import { isListenTogetherIdle, useListenTogetherStore } from './listen-together-store';
import type { ListenTogetherInvite, ListenTogetherSession } from '@/types/listen-together';

const MINA = {
  id: '111111111111111111111111',
  username: 'mina',
  displayName: 'Mina',
  avatarUrl: null,
};
const ALICE = {
  id: '222222222222222222222222',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
};
const TRACK = {
  videoId: 'abc123',
  title: 'Anti-Hero',
  artist: 'Taylor Swift',
  thumbnailUrl: 'https://example.com/cover.jpg',
  durationSeconds: 200,
};

const INVITE: ListenTogetherInvite = {
  id: 'lt_aaaa111122223333',
  from: MINA,
  to: ALICE,
  track: TRACK,
  createdAt: new Date(0).toISOString(),
  expiresAt: new Date(60_000).toISOString(),
};

const SESSION: ListenTogetherSession = {
  id: 'lts_bbbb111122223333',
  host: MINA,
  viewer: ALICE,
  track: TRACK,
  startedAt: new Date(0).toISOString(),
};

beforeEach(() => {
  useListenTogetherStore.getState().reset();
});

describe('listen-together-store', () => {
  test('starts idle', () => {
    const s = useListenTogetherStore.getState();
    expect(s.incomingInvite).toBeNull();
    expect(s.sentInvite).toBeNull();
    expect(s.activeSession).toBeNull();
    expect(s.role).toBeNull();
    expect(isListenTogetherIdle(s)).toBe(true);
  });

  test('setIncomingInvite stages an invite without entering a session', () => {
    useListenTogetherStore.getState().setIncomingInvite(INVITE);
    const s = useListenTogetherStore.getState();
    expect(s.incomingInvite).toEqual(INVITE);
    expect(s.activeSession).toBeNull();
    expect(isListenTogetherIdle(s)).toBe(false);
  });

  test('enterSession clears invites and sets role', () => {
    const store = useListenTogetherStore.getState();
    store.setSentInvite(INVITE);
    store.enterSession(SESSION, 'host');
    const s = useListenTogetherStore.getState();
    expect(s.sentInvite).toBeNull();
    expect(s.incomingInvite).toBeNull();
    expect(s.activeSession).toEqual(SESSION);
    expect(s.role).toBe('host');
  });

  test('leaveSession clears session + role but preserves a fresh invite', () => {
    const store = useListenTogetherStore.getState();
    store.enterSession(SESSION, 'viewer');
    store.setIncomingInvite(INVITE);
    store.leaveSession();
    const s = useListenTogetherStore.getState();
    expect(s.activeSession).toBeNull();
    expect(s.role).toBeNull();
    expect(s.incomingInvite).toEqual(INVITE);
  });

  test('reset clears every field', () => {
    const store = useListenTogetherStore.getState();
    store.setIncomingInvite(INVITE);
    store.setSentInvite(INVITE);
    store.enterSession(SESSION, 'host');
    store.reset();
    expect(isListenTogetherIdle(useListenTogetherStore.getState())).toBe(true);
  });
});
