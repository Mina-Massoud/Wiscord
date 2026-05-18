import { describe, expect, test } from 'vitest';

import {
  consumePendingCall,
  registerPendingCall,
} from '../../src/modules/ai/pending-tool-store.js';

describe('pending-tool-store', () => {
  test('register + consume returns the original payload', () => {
    const callId = registerPendingCall({
      userId: 'user-1',
      name: 'updateCalendarEvent',
      args: { eventId: 'abc', title: 'new title' },
    });
    const consumed = consumePendingCall(callId, 'user-1');
    expect(consumed).not.toBeNull();
    expect(consumed?.name).toBe('updateCalendarEvent');
    expect((consumed?.args as { title: string }).title).toBe('new title');
  });

  test('consume is single-use — second call returns null', () => {
    const callId = registerPendingCall({
      userId: 'user-1',
      name: 'deleteCalendarEvent',
      args: { eventId: 'abc' },
    });
    expect(consumePendingCall(callId, 'user-1')).not.toBeNull();
    expect(consumePendingCall(callId, 'user-1')).toBeNull();
  });

  test('cross-user consume is rejected', () => {
    const callId = registerPendingCall({
      userId: 'user-1',
      name: 'deleteCalendarEvent',
      args: { eventId: 'abc' },
    });
    expect(consumePendingCall(callId, 'user-2')).toBeNull();
    // Owner can still consume — cross-user attempts don't void the entry.
    expect(consumePendingCall(callId, 'user-1')).not.toBeNull();
  });

  test('unknown callId returns null', () => {
    expect(consumePendingCall('not-a-real-id', 'user-1')).toBeNull();
  });
});
