import { describe, expect, test } from 'vitest';

import { resolveView } from './MusicCapsule';

/**
 * The capsule's `resolveView` controls every visible mode of the music
 * surface. The view morph is one transformation of this output, so the
 * priority ordering here is load-bearing for the entire feature.
 *
 * Priority (high → low):
 *   1. incoming invite (connected vs disconnected branch on `hasIntegration`)
 *   2. active session (viewer mirror; host stays on regular now-playing)
 *   3. outgoing invite chip
 *   4. regular music idle / bar / expanded
 */

const BASE = {
  hasIntegration: true,
  incomingInvite: false,
  activeSession: false,
  sentInvite: false,
  role: null,
  hasTrack: false,
  expanded: false,
} as const;

describe('resolveView', () => {
  test('default is idle', () => {
    expect(resolveView({ ...BASE })).toBe('idle');
  });

  test('hasTrack → bar', () => {
    expect(resolveView({ ...BASE, hasTrack: true })).toBe('bar');
  });

  test('expanded with no track → expanded-search', () => {
    expect(resolveView({ ...BASE, expanded: true })).toBe('expanded-search');
  });

  test('expanded with track → expanded-now-playing', () => {
    expect(resolveView({ ...BASE, hasTrack: true, expanded: true })).toBe('expanded-now-playing');
  });

  test('sentInvite shows the outgoing-pending chip', () => {
    expect(resolveView({ ...BASE, sentInvite: true })).toBe('invite-outgoing-pending');
  });

  test('sentInvite is shadowed by an active session', () => {
    expect(resolveView({ ...BASE, sentInvite: true, activeSession: true, role: 'host' })).toBe(
      'bar',
    );
  });

  test('activeSession as viewer (expanded) → listen-together-now-playing', () => {
    expect(resolveView({ ...BASE, activeSession: true, role: 'viewer', expanded: true })).toBe(
      'listen-together-now-playing',
    );
  });

  test('activeSession as viewer (collapsed) → bar', () => {
    // Viewer can dismiss the listen-together card to the bar without
    // ending the session — they keep listening, the modal-feeling card
    // just gets out of the way.
    expect(resolveView({ ...BASE, activeSession: true, role: 'viewer' })).toBe('bar');
  });

  test('activeSession as host (expanded) → expanded-now-playing', () => {
    expect(resolveView({ ...BASE, activeSession: true, role: 'host', expanded: true })).toBe(
      'expanded-now-playing',
    );
  });

  test('activeSession as host (collapsed) → bar', () => {
    expect(resolveView({ ...BASE, activeSession: true, role: 'host' })).toBe('bar');
  });

  test('incomingInvite + integration → connected pill', () => {
    expect(resolveView({ ...BASE, incomingInvite: true })).toBe('invite-incoming-connected');
  });

  test('incomingInvite + no integration → disconnected card', () => {
    expect(resolveView({ ...BASE, incomingInvite: true, hasIntegration: false })).toBe(
      'invite-incoming-disconnected',
    );
  });

  test('incomingInvite wins over an active session', () => {
    // Server enforces no-double-session, but if a race lands an invite
    // while a session is mid-teardown, the invite is the more recent
    // user intention and should display.
    expect(resolveView({ ...BASE, incomingInvite: true, activeSession: true, role: 'host' })).toBe(
      'invite-incoming-connected',
    );
  });

  test('incomingInvite wins over expanded + track', () => {
    expect(resolveView({ ...BASE, incomingInvite: true, expanded: true, hasTrack: true })).toBe(
      'invite-incoming-connected',
    );
  });
});
