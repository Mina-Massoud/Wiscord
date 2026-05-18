import { beforeEach, describe, expect, it } from 'vitest';

import {
  getPomodoroRemainingMs,
  getPomodoroTotalSeconds,
  usePomodoroStore,
} from './usePomodoroStore';

beforeEach(() => {
  usePomodoroStore.getState().end();
  localStorage.clear();
});

describe('usePomodoroStore', () => {
  it('start sets phase, round 1, and a future endsAt', () => {
    const before = Date.now();
    usePomodoroStore.getState().start();
    const s = usePomodoroStore.getState();
    expect(s.phase).toBe('focus');
    expect(s.round).toBe(1);
    expect(s.endsAt).not.toBeNull();
    expect(s.endsAt!).toBeGreaterThan(before);
    expect(s.pausedRemainingMs).toBeNull();
  });

  it('pause captures remaining ms and clears endsAt', () => {
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().pause();
    const s = usePomodoroStore.getState();
    expect(s.endsAt).toBeNull();
    expect(s.pausedRemainingMs).not.toBeNull();
    expect(s.pausedRemainingMs!).toBeGreaterThan(0);
  });

  it('resume re-anchors endsAt from pausedRemainingMs', () => {
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().pause();
    const pausedMs = usePomodoroStore.getState().pausedRemainingMs!;
    usePomodoroStore.getState().resume();
    const s = usePomodoroStore.getState();
    expect(s.pausedRemainingMs).toBeNull();
    expect(s.endsAt).not.toBeNull();
    expect(s.endsAt!).toBeGreaterThanOrEqual(Date.now() + pausedMs - 50);
  });

  it('skip from focus transitions to break in same round', () => {
    usePomodoroStore.getState().start();
    const startRound = usePomodoroStore.getState().round;
    usePomodoroStore.getState().skip();
    const s = usePomodoroStore.getState();
    expect(s.phase).toBe('break');
    expect(s.round).toBe(startRound);
  });

  it('skip from break advances to focus + round + 1 when rounds remain', () => {
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().skip();
    usePomodoroStore.getState().skip();
    const s = usePomodoroStore.getState();
    expect(s.phase).toBe('focus');
    expect(s.round).toBe(2);
  });

  it('skip from final break ends the session', () => {
    usePomodoroStore.setState({
      phase: 'break',
      round: 4,
      totalRounds: 4,
      endsAt: Date.now() + 60_000,
      pausedRemainingMs: null,
    });
    usePomodoroStore.getState().skip();
    const s = usePomodoroStore.getState();
    expect(s.phase).toBeNull();
    expect(s.round).toBe(0);
  });

  it('addFiveMinutes extends endsAt when running', () => {
    usePomodoroStore.getState().start();
    const before = usePomodoroStore.getState().endsAt!;
    usePomodoroStore.getState().addFiveMinutes();
    expect(usePomodoroStore.getState().endsAt).toBe(before + 5 * 60_000);
  });

  it('addFiveMinutes extends pausedRemainingMs when paused', () => {
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().pause();
    const before = usePomodoroStore.getState().pausedRemainingMs!;
    usePomodoroStore.getState().addFiveMinutes();
    expect(usePomodoroStore.getState().pausedRemainingMs).toBe(before + 5 * 60_000);
  });

  it('end resets everything', () => {
    usePomodoroStore.getState().start();
    usePomodoroStore.getState().end();
    const s = usePomodoroStore.getState();
    expect(s.phase).toBeNull();
    expect(s.round).toBe(0);
    expect(s.endsAt).toBeNull();
    expect(s.pausedRemainingMs).toBeNull();
  });
});

describe('getPomodoroRemainingMs', () => {
  it('returns 0 when phase is null', () => {
    expect(
      getPomodoroRemainingMs({
        phase: null,
        endsAt: null,
        pausedRemainingMs: null,
        round: 0,
        totalRounds: 4,
      }),
    ).toBe(0);
  });

  it('returns pausedRemainingMs when paused', () => {
    expect(
      getPomodoroRemainingMs({
        phase: 'focus',
        endsAt: null,
        pausedRemainingMs: 123_000,
        round: 1,
        totalRounds: 4,
      }),
    ).toBe(123_000);
  });

  it('returns endsAt - now when running', () => {
    const now = 1_000_000;
    const endsAt = now + 60_000;
    expect(
      getPomodoroRemainingMs(
        { phase: 'focus', endsAt, pausedRemainingMs: null, round: 1, totalRounds: 4 },
        now,
      ),
    ).toBe(60_000);
  });

  it('floors at 0 when endsAt is past', () => {
    const now = 1_000_000;
    expect(
      getPomodoroRemainingMs(
        {
          phase: 'focus',
          endsAt: now - 5_000,
          pausedRemainingMs: null,
          round: 1,
          totalRounds: 4,
        },
        now,
      ),
    ).toBe(0);
  });
});

describe('getPomodoroTotalSeconds', () => {
  it('returns 25 minutes for focus', () => {
    expect(getPomodoroTotalSeconds('focus')).toBe(25 * 60);
  });
  it('returns 5 minutes for break', () => {
    expect(getPomodoroTotalSeconds('break')).toBe(5 * 60);
  });
});
