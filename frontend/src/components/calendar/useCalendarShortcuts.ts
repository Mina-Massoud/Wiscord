import { useEffect } from 'react';

import type { CalendarView } from '@/types/calendar';

interface UseCalendarShortcutsArgs {
  enabled?: boolean;
  onSetView: (view: CalendarView) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onNewEvent: () => void;
}

/**
 * Keyboard map matching the reference site:
 *
 *  ⌘M / Ctrl+M → Month
 *  ⌘W / Ctrl+W → Week
 *  ⌘D / Ctrl+D → Day
 *  T           → Today (no modifier)
 *  J           → Previous window
 *  K           → Next window
 *  N           → New event
 *
 * Plain-letter shortcuts only fire when nothing is focused on an editable
 * element so they don't hijack typing inside the composer.
 */
export function useCalendarShortcuts({
  enabled = true,
  onSetView,
  onToday,
  onPrev,
  onNext,
  onNewEvent,
}: UseCalendarShortcutsArgs): void {
  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent): void {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && (key === 'm' || key === 'w' || key === 'd')) {
        e.preventDefault();
        if (key === 'm') onSetView('month');
        else if (key === 'w') onSetView('week');
        else if (key === 'd') onSetView('day');
        return;
      }

      // Letter shortcuts ignore key presses inside editable surfaces.
      const target = e.target as HTMLElement | null;
      if (target && isEditableTarget(target)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (key === 't') {
        e.preventDefault();
        onToday();
      } else if (key === 'j') {
        e.preventDefault();
        onPrev();
      } else if (key === 'k') {
        e.preventDefault();
        onNext();
      } else if (key === 'n') {
        e.preventDefault();
        onNewEvent();
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onSetView, onToday, onPrev, onNext, onNewEvent]);
}

function isEditableTarget(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
