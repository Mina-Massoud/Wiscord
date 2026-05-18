import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  inviteIdParam,
  playbackBody,
  sendInviteBody,
  sessionIdParam,
} from '../src/modules/listen-together/schemas.js';
import {
  ListenTogetherSessionStore,
  type ListenTogetherInviteResolvedEvent,
  type ListenTogetherInviteSentEvent,
  type ListenTogetherPlaybackEvent,
  type ListenTogetherSessionEndedEvent,
} from '../src/modules/listen-together/sessionStore.js';
import type {
  ListenTogetherTrackDto,
  ListenTogetherUserDto,
} from '../src/modules/listen-together/schemas.js';

// ── Schema tests ────────────────────────────────────────────────────────

const VALID_OID = '1234567890abcdef12345678';
const TRACK = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  artist: 'Rick Astley',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  durationSeconds: 213,
};

describe('sendInviteBody', () => {
  test('accepts a valid invite body', () => {
    const parsed = sendInviteBody.parse({ toUserId: VALID_OID, track: TRACK });
    expect(parsed.toUserId).toBe(VALID_OID);
    expect(parsed.track.videoId).toBe('dQw4w9WgXcQ');
  });

  test('rejects a bad toUserId', () => {
    expect(() =>
      sendInviteBody.parse({ toUserId: 'not-an-oid', track: TRACK }),
    ).toThrow();
  });

  test('rejects a missing track', () => {
    expect(() => sendInviteBody.parse({ toUserId: VALID_OID })).toThrow();
  });

  test('rejects a bad videoId', () => {
    expect(() =>
      sendInviteBody.parse({
        toUserId: VALID_OID,
        track: { ...TRACK, videoId: 'has spaces' },
      }),
    ).toThrow();
  });

  test('rejects extra properties', () => {
    expect(() =>
      sendInviteBody.parse({ toUserId: VALID_OID, track: TRACK, sneaky: true }),
    ).toThrow();
  });

  test('accepts null durationSeconds', () => {
    const parsed = sendInviteBody.parse({
      toUserId: VALID_OID,
      track: { ...TRACK, durationSeconds: null },
    });
    expect(parsed.track.durationSeconds).toBeNull();
  });
});

describe('inviteIdParam / sessionIdParam', () => {
  test('accepts the prefixed id formats', () => {
    expect(inviteIdParam.parse({ id: 'lt_abcdef0123456789' }).id).toBe(
      'lt_abcdef0123456789',
    );
    expect(sessionIdParam.parse({ id: 'lts_abcdef0123456789' }).id).toBe(
      'lts_abcdef0123456789',
    );
  });

  test('rejects non-prefixed ids', () => {
    expect(() => inviteIdParam.parse({ id: 'abcdef0123456789' })).toThrow();
    expect(() => sessionIdParam.parse({ id: 'lts_' })).toThrow();
  });

  test('rejects an invite id used as a session id', () => {
    expect(() => sessionIdParam.parse({ id: 'lt_abcdef0123456789' })).toThrow();
  });
});

describe('playbackBody', () => {
  test('accepts play', () => {
    const parsed = playbackBody.parse({ kind: 'play', hostProgressMs: 1000 });
    expect(parsed.kind).toBe('play');
  });

  test('accepts seek with ms', () => {
    const parsed = playbackBody.parse({
      kind: 'seek',
      ms: 5000,
      hostProgressMs: 5000,
    });
    expect(parsed).toMatchObject({ kind: 'seek', ms: 5000 });
  });

  test('accepts track_changed with a track', () => {
    const parsed = playbackBody.parse({
      kind: 'track_changed',
      track: TRACK,
      hostProgressMs: 0,
    });
    expect(parsed.kind).toBe('track_changed');
  });

  test('rejects seek without ms', () => {
    expect(() =>
      playbackBody.parse({ kind: 'seek', hostProgressMs: 1000 }),
    ).toThrow();
  });

  test('rejects unknown kind', () => {
    expect(() =>
      playbackBody.parse({ kind: 'shuffle', hostProgressMs: 0 }),
    ).toThrow();
  });
});

// ── Session store behaviour ────────────────────────────────────────────

const MINA: ListenTogetherUserDto = {
  id: '111111111111111111111111',
  username: 'mina',
  displayName: 'Mina',
  avatarUrl: null,
};
const ALICE: ListenTogetherUserDto = {
  id: '222222222222222222222222',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
};
const BOB: ListenTogetherUserDto = {
  id: '333333333333333333333333',
  username: 'bob',
  displayName: 'Bob',
  avatarUrl: null,
};
const STORE_TRACK: ListenTogetherTrackDto = TRACK;

interface CapturedEvents {
  invitesSent: ListenTogetherInviteSentEvent[];
  invitesResolved: ListenTogetherInviteResolvedEvent[];
  sessionsEnded: ListenTogetherSessionEndedEvent[];
  playbacks: ListenTogetherPlaybackEvent[];
}

function captureEvents(store: ListenTogetherSessionStore): CapturedEvents {
  const captured: CapturedEvents = {
    invitesSent: [],
    invitesResolved: [],
    sessionsEnded: [],
    playbacks: [],
  };
  store.on('invite:sent', (e) => captured.invitesSent.push(e));
  store.on('invite:resolved', (e) => captured.invitesResolved.push(e));
  store.on('session:ended', (e) => captured.sessionsEnded.push(e));
  store.on('session:playback', (e) => captured.playbacks.push(e));
  return captured;
}

describe('ListenTogetherSessionStore', () => {
  let store: ListenTogetherSessionStore;
  let events: CapturedEvents;

  beforeEach(() => {
    store = new ListenTogetherSessionStore();
    events = captureEvents(store);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('sendInvite emits invite:sent to the recipient', () => {
    const result = store.sendInvite(MINA, ALICE, STORE_TRACK);
    expect(result.ok).toBe(true);
    expect(events.invitesSent).toHaveLength(1);
    expect(events.invitesSent[0]!.toUserId).toBe(ALICE.id);
    expect(events.invitesSent[0]!.invite.from.id).toBe(MINA.id);
    expect(events.invitesSent[0]!.invite.to.id).toBe(ALICE.id);
  });

  test('cannot invite yourself', () => {
    const result = store.sendInvite(MINA, MINA, STORE_TRACK);
    expect(result).toEqual({ ok: false, code: 'self_invite' });
    expect(events.invitesSent).toHaveLength(0);
  });

  test('cannot invite while either party is in a session', () => {
    const a = store.sendInvite(MINA, ALICE, STORE_TRACK);
    expect(a.ok).toBe(true);
    const inviteId = (a as { ok: true; invite: { id: string } }).invite.id;
    store.acceptInvite(ALICE.id, inviteId);

    // Mina is now busy with Alice; can't invite Bob.
    const b = store.sendInvite(MINA, BOB, STORE_TRACK);
    expect(b).toEqual({ ok: false, code: 'already_in_session' });

    // Bob can't invite Alice either (Alice is busy).
    const c = store.sendInvite(BOB, ALICE, STORE_TRACK);
    expect(c).toEqual({ ok: false, code: 'already_in_session' });
  });

  test('acceptInvite opens a session and notifies both sides', () => {
    const sent = store.sendInvite(MINA, ALICE, STORE_TRACK);
    const inviteId = (sent as { ok: true; invite: { id: string } }).invite.id;
    const result = store.acceptInvite(ALICE.id, inviteId);
    expect(result.ok).toBe(true);

    const acceptedEvents = events.invitesResolved.filter((e) => e.outcome === 'accepted');
    expect(acceptedEvents).toHaveLength(2);
    expect(new Set(acceptedEvents.map((e) => e.toUserId))).toEqual(
      new Set([MINA.id, ALICE.id]),
    );

    expect(store.getSessionForUser(MINA.id)).not.toBeNull();
    expect(store.getSessionForUser(ALICE.id)).not.toBeNull();
  });

  test('only the recipient can accept', () => {
    const sent = store.sendInvite(MINA, ALICE, STORE_TRACK);
    const inviteId = (sent as { ok: true; invite: { id: string } }).invite.id;
    const result = store.acceptInvite(BOB.id, inviteId);
    expect(result).toEqual({ ok: false, code: 'not_recipient' });
  });

  test('declineInvite removes it and notifies the sender only', () => {
    const sent = store.sendInvite(MINA, ALICE, STORE_TRACK);
    const inviteId = (sent as { ok: true; invite: { id: string } }).invite.id;

    const result = store.declineInvite(ALICE.id, inviteId);
    expect(result.ok).toBe(true);

    const declined = events.invitesResolved.filter((e) => e.outcome === 'declined');
    expect(declined).toHaveLength(1);
    expect(declined[0]!.toUserId).toBe(MINA.id);
    expect(store.getInvite(inviteId)).toBeNull();
  });

  test('invite expires after 60 seconds and fires resolved=expired on both sides', () => {
    vi.useFakeTimers();
    store.sendInvite(MINA, ALICE, STORE_TRACK);
    vi.advanceTimersByTime(59_999);
    expect(events.invitesResolved.filter((e) => e.outcome === 'expired')).toHaveLength(0);
    vi.advanceTimersByTime(2);
    const expired = events.invitesResolved.filter((e) => e.outcome === 'expired');
    expect(expired).toHaveLength(2);
    expect(new Set(expired.map((e) => e.toUserId))).toEqual(
      new Set([MINA.id, ALICE.id]),
    );
  });

  test('re-inviting the same recipient cancels the prior pending invite', () => {
    store.sendInvite(MINA, ALICE, STORE_TRACK);
    store.sendInvite(MINA, ALICE, { ...STORE_TRACK, videoId: 'aaaaaaaaaaa' });

    // Only the *second* invite remains pending; the first is gone but should
    // not emit an "expired" event (no notify on re-invite).
    expect(events.invitesSent).toHaveLength(2);
    expect(events.invitesResolved).toHaveLength(0);
  });

  test('accepting one invite cancels other pending invites for both parties', () => {
    // Bob also invites Alice.
    store.sendInvite(BOB, ALICE, STORE_TRACK);
    // Mina then invites Alice.
    const sent = store.sendInvite(MINA, ALICE, STORE_TRACK);
    const inviteId = (sent as { ok: true; invite: { id: string } }).invite.id;
    // Alice accepts Mina's invite — Bob's should expire.
    store.acceptInvite(ALICE.id, inviteId);

    const expired = events.invitesResolved.filter((e) => e.outcome === 'expired');
    // Two emits: one to Bob, one to Alice.
    expect(expired.length).toBeGreaterThanOrEqual(2);
    expect(expired.map((e) => e.toUserId)).toContain(BOB.id);
  });

  test('endSession can be called by either participant and notifies the other', () => {
    const sent = store.sendInvite(MINA, ALICE, STORE_TRACK);
    const inviteId = (sent as { ok: true; invite: { id: string } }).invite.id;
    const accept = store.acceptInvite(ALICE.id, inviteId);
    const sessionId = (accept as { ok: true; session: { id: string } }).session.id;

    const result = store.endSession(ALICE.id, sessionId);
    expect(result.ok).toBe(true);
    expect(events.sessionsEnded).toHaveLength(1);
    expect(events.sessionsEnded[0]!.toUserId).toBe(MINA.id);
    expect(events.sessionsEnded[0]!.reason).toBe('left');
    expect(store.getSessionForUser(MINA.id)).toBeNull();
  });

  test('endSession rejects callers who are not participants', () => {
    const sent = store.sendInvite(MINA, ALICE, STORE_TRACK);
    const inviteId = (sent as { ok: true; invite: { id: string } }).invite.id;
    const accept = store.acceptInvite(ALICE.id, inviteId);
    const sessionId = (accept as { ok: true; session: { id: string } }).session.id;

    const result = store.endSession(BOB.id, sessionId);
    expect(result).toEqual({ ok: false, code: 'not_participant' });
  });

  test('broadcastPlayback rejects non-hosts', () => {
    const sent = store.sendInvite(MINA, ALICE, STORE_TRACK);
    const inviteId = (sent as { ok: true; invite: { id: string } }).invite.id;
    const accept = store.acceptInvite(ALICE.id, inviteId);
    const sessionId = (accept as { ok: true; session: { id: string } }).session.id;

    const aliceTry = store.broadcastPlayback(ALICE.id, sessionId, {
      kind: 'pause',
      hostProgressMs: 100,
    });
    expect(aliceTry).toEqual({ ok: false, code: 'not_host' });
  });

  test('broadcastPlayback from host emits playback to the viewer', () => {
    const sent = store.sendInvite(MINA, ALICE, STORE_TRACK);
    const inviteId = (sent as { ok: true; invite: { id: string } }).invite.id;
    const accept = store.acceptInvite(ALICE.id, inviteId);
    const sessionId = (accept as { ok: true; session: { id: string } }).session.id;

    const result = store.broadcastPlayback(MINA.id, sessionId, {
      kind: 'seek',
      ms: 12_345,
      hostProgressMs: 12_345,
    });
    expect(result.ok).toBe(true);
    expect(events.playbacks).toHaveLength(1);
    expect(events.playbacks[0]!.toUserId).toBe(ALICE.id);
    expect(events.playbacks[0]!.playback).toMatchObject({
      kind: 'seek',
      ms: 12_345,
      hostProgressMs: 12_345,
    });
  });

  test('handleDisconnect tears down active session and pending invites', () => {
    // Pending invite from Mina to Alice.
    store.sendInvite(MINA, ALICE, STORE_TRACK);
    // Separate active session: Bob hosts Alice. Wait — Alice is already
    // receiving Mina's invite, so this is fine; she can be in one session
    // *or* have invites pending. Build a clean scenario:
    const bobInvite = store.sendInvite(BOB, MINA, STORE_TRACK);
    const bobInviteId = (bobInvite as { ok: true; invite: { id: string } }).invite.id;
    store.acceptInvite(MINA.id, bobInviteId);
    // Mina ↔ Bob now share a session. Accepting cancels Mina's pending
    // invite to Alice (since Mina entered a session). That emits expired;
    // clear the captured array so the assertions below are unambiguous.
    events.invitesResolved.length = 0;
    events.sessionsEnded.length = 0;

    store.handleDisconnect(MINA.id);

    // Bob notified that the session ended.
    expect(events.sessionsEnded).toHaveLength(1);
    expect(events.sessionsEnded[0]!.toUserId).toBe(BOB.id);
    expect(events.sessionsEnded[0]!.reason).toBe('disconnected');

    expect(store.getSessionForUser(MINA.id)).toBeNull();
    expect(store.getSessionForUser(BOB.id)).toBeNull();
  });
});
