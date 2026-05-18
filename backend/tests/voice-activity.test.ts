import { describe, expect, test } from 'vitest';

import {
  channelIdParam,
  controlBody,
  pinQuizBody,
  setPresenceBody,
  startActivityBody,
  transferHostBody,
} from '../src/modules/voice-activity/schemas.js';

const VALID_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const VALID_OBJECT_ID = '1234567890abcdef12345678';

describe('channelIdParam', () => {
  test('accepts a valid UUID', () => {
    expect(channelIdParam.parse({ channelId: VALID_UUID }).channelId).toBe(VALID_UUID);
  });

  test('rejects a non-UUID', () => {
    expect(() => channelIdParam.parse({ channelId: 'not-a-uuid' })).toThrow();
  });
});

describe('startActivityBody — watch kinds', () => {
  test('accepts a YouTube activity', () => {
    const parsed = startActivityBody.parse({
      kind: 'youtube',
      source: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    expect(parsed.kind).toBe('youtube');
    if (parsed.kind === 'youtube') expect(parsed.source.kind).toBe('youtube');
  });

  test('accepts a screen-share activity', () => {
    const parsed = startActivityBody.parse({
      kind: 'screen-share',
      source: { kind: 'screen', url: 'livekit:screen-share', title: 'Shared screen' },
    });
    expect(parsed.kind).toBe('screen-share');
    if (parsed.kind === 'screen-share') expect(parsed.source.title).toBe('Shared screen');
  });

  test('rejects a YouTube activity without a source', () => {
    expect(() => startActivityBody.parse({ kind: 'youtube' })).toThrow();
  });

  test('rejects an invalid source URL', () => {
    expect(() =>
      startActivityBody.parse({
        kind: 'youtube',
        source: { kind: 'youtube', url: 'not a url' },
      }),
    ).toThrow();
  });

  test('rejects an unknown source kind', () => {
    expect(() =>
      startActivityBody.parse({
        kind: 'youtube',
        source: { kind: 'magnet', url: 'https://example.com/x.mp4' },
      }),
    ).toThrow();
  });
});

describe('startActivityBody — lab kinds', () => {
  test('accepts a notes activity with no extra payload', () => {
    expect(startActivityBody.parse({ kind: 'notes' }).kind).toBe('notes');
  });

  test('accepts a whiteboard activity with no extra payload', () => {
    expect(startActivityBody.parse({ kind: 'whiteboard' }).kind).toBe('whiteboard');
  });

  test('accepts a quiz activity with a null quizId', () => {
    const parsed = startActivityBody.parse({ kind: 'quiz', quizId: null });
    expect(parsed.kind).toBe('quiz');
    if (parsed.kind === 'quiz') expect(parsed.quizId).toBeNull();
  });

  test('accepts a quiz activity with a quizId', () => {
    const parsed = startActivityBody.parse({ kind: 'quiz', quizId: VALID_OBJECT_ID });
    if (parsed.kind === 'quiz') expect(parsed.quizId).toBe(VALID_OBJECT_ID);
  });

  test('rejects a quiz activity with a malformed quizId', () => {
    expect(() => startActivityBody.parse({ kind: 'quiz', quizId: 'not-an-object-id' })).toThrow();
  });

  test('rejects an unknown activity kind', () => {
    expect(() => startActivityBody.parse({ kind: 'unknown' })).toThrow();
  });
});

describe('controlBody', () => {
  test('accepts play/pause/seek with valid timeMs', () => {
    expect(controlBody.parse({ action: 'play', timeMs: 0 }).action).toBe('play');
    expect(controlBody.parse({ action: 'pause', timeMs: 5_000 }).timeMs).toBe(5_000);
    expect(controlBody.parse({ action: 'seek', timeMs: 60_000 }).action).toBe('seek');
  });

  test('rejects negative time', () => {
    expect(() => controlBody.parse({ action: 'play', timeMs: -1 })).toThrow();
  });

  test('rejects fractional time (must be integer ms)', () => {
    expect(() => controlBody.parse({ action: 'play', timeMs: 1.5 })).toThrow();
  });

  test('rejects an unknown action', () => {
    expect(() => controlBody.parse({ action: 'stop', timeMs: 0 })).toThrow();
  });

  test('rejects absurd time values', () => {
    expect(() => controlBody.parse({ action: 'play', timeMs: 99_999_999_999 })).toThrow();
  });
});

describe('transferHostBody', () => {
  test('accepts a target user id', () => {
    expect(transferHostBody.parse({ toUserId: 'user-1' }).toUserId).toBe('user-1');
  });

  test('rejects an empty id', () => {
    expect(() => transferHostBody.parse({ toUserId: '' })).toThrow();
  });
});

describe('setPresenceBody', () => {
  test('accepts each activity kind', () => {
    for (const kind of ['youtube', 'screen-share', 'notes', 'whiteboard', 'quiz']) {
      expect(setPresenceBody.parse({ kind }).kind).toBe(kind);
    }
  });

  test('accepts null to mark "I left my activity"', () => {
    expect(setPresenceBody.parse({ kind: null }).kind).toBeNull();
  });

  test('rejects an unknown kind', () => {
    expect(() => setPresenceBody.parse({ kind: 'flashcards' })).toThrow();
  });

  test('rejects a missing kind field', () => {
    expect(() => setPresenceBody.parse({})).toThrow();
  });
});

describe('pinQuizBody', () => {
  test('accepts a quizId', () => {
    expect(pinQuizBody.parse({ quizId: VALID_OBJECT_ID }).quizId).toBe(VALID_OBJECT_ID);
  });

  test('accepts null to unpin', () => {
    expect(pinQuizBody.parse({ quizId: null }).quizId).toBeNull();
  });

  test('rejects a malformed quizId', () => {
    expect(() => pinQuizBody.parse({ quizId: 'nope' })).toThrow();
  });
});
