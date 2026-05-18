import { describe, expect, it } from 'vitest';

import { deriveMode } from './DynamicIsland';

const base = {
  expandedTo: null,
  minutesAway: null,
  pomodoroActive: false,
  sharedPomodoroActive: false,
  idleWidget: 'date' as const,
};

describe('deriveMode', () => {
  describe('expanded states', () => {
    it("returns 'expanded' when expandedTo === 'calendar'", () => {
      expect(deriveMode({ ...base, expandedTo: 'calendar' })).toBe('expanded');
    });

    it("returns 'pomodoro-card' when expandedTo === 'pomodoro'", () => {
      expect(deriveMode({ ...base, expandedTo: 'pomodoro' })).toBe('pomodoro-card');
    });

    it('expanded states win over every auto-priority signal', () => {
      expect(
        deriveMode({
          ...base,
          expandedTo: 'calendar',
          minutesAway: 3,
          pomodoroActive: true,
          idleWidget: 'next-event',
        }),
      ).toBe('expanded');
      expect(
        deriveMode({
          ...base,
          expandedTo: 'pomodoro',
          minutesAway: 3,
          pomodoroActive: true,
        }),
      ).toBe('pomodoro-card');
    });
  });

  describe('idle auto-priority', () => {
    it('event-soon fires when minutesAway is within the 15-min window', () => {
      expect(deriveMode({ ...base, minutesAway: 15 })).toBe('event-soon');
      expect(deriveMode({ ...base, minutesAway: 0 })).toBe('event-soon');
      expect(deriveMode({ ...base, minutesAway: -2 })).toBe('event-soon');
    });

    it('event-soon outranks pomodoro-tick when both are active', () => {
      expect(deriveMode({ ...base, minutesAway: 5, pomodoroActive: true })).toBe('event-soon');
    });

    it('event-soon outranks the idle widget preference', () => {
      expect(deriveMode({ ...base, minutesAway: 5, idleWidget: 'next-event' })).toBe('event-soon');
    });

    it('pomodoro-tick fires when a timer is running and no event is imminent', () => {
      expect(deriveMode({ ...base, pomodoroActive: true })).toBe('pomodoro-tick');
      expect(deriveMode({ ...base, pomodoroActive: true, minutesAway: 60 })).toBe('pomodoro-tick');
    });

    it('pomodoro-tick outranks the idle widget preference', () => {
      expect(deriveMode({ ...base, pomodoroActive: true, idleWidget: 'next-event' })).toBe(
        'pomodoro-tick',
      );
    });

    it("shared pomodoro alone surfaces 'pomodoro-tick'", () => {
      expect(deriveMode({ ...base, sharedPomodoroActive: true })).toBe('pomodoro-tick');
    });

    it('shared pomodoro outranks the idle widget preference', () => {
      expect(deriveMode({ ...base, sharedPomodoroActive: true, idleWidget: 'next-event' })).toBe(
        'pomodoro-tick',
      );
    });

    it('event-soon still wins over shared pomodoro (more time-sensitive)', () => {
      expect(deriveMode({ ...base, sharedPomodoroActive: true, minutesAway: 5 })).toBe(
        'event-soon',
      );
    });

    it('shared pomodoro renders the same mode as solo (the slot picks data source)', () => {
      // Both active → still pomodoro-tick. Slot logic in DynamicIsland
      // decides which payload (shared vs solo) to render.
      expect(deriveMode({ ...base, sharedPomodoroActive: true, pomodoroActive: true })).toBe(
        'pomodoro-tick',
      );
    });
  });

  describe('idle fallback', () => {
    it("returns 'next-event' when idleWidget preference is next-event and no override fires", () => {
      expect(deriveMode({ ...base, idleWidget: 'next-event' })).toBe('next-event');
    });

    it("returns 'date' when idleWidget is date and nothing else is happening", () => {
      expect(deriveMode(base)).toBe('date');
    });

    it("returns 'date' when an event exists today but is too far away (>15 min)", () => {
      expect(deriveMode({ ...base, minutesAway: 30 })).toBe('date');
      expect(deriveMode({ ...base, minutesAway: 120 })).toBe('date');
    });
  });
});
