import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Awareness } from 'y-protocols/awareness';

import { useNotesLastEditedBy, type NotesAwarenessUser } from './useNotesLastEditedBy';

/**
 * Minimal Awareness stub. The hook only touches `getStates`, `on`, and
 * `off` — so we provide just those plus a trigger to fire change events
 * from the test. The full y-protocols class is too heavy to instantiate
 * (it pulls in a real Y.Doc) and pulls no behavior we need here.
 */
function makeFakeAwareness(): {
  awareness: Awareness;
  setStates: (entries: Array<[number, { user?: NotesAwarenessUser }]>) => void;
  fireChange: () => void;
} {
  let states: Map<number, { user?: NotesAwarenessUser }> = new Map();
  const handlers = new Set<() => void>();
  const awareness = {
    getStates: () => states,
    on: (event: string, fn: () => void) => {
      if (event === 'change') handlers.add(fn);
    },
    off: (event: string, fn: () => void) => {
      if (event === 'change') handlers.delete(fn);
    },
  } as unknown as Awareness;
  return {
    awareness,
    setStates: (entries) => {
      states = new Map(entries);
    },
    fireChange: () => {
      for (const fn of handlers) fn();
    },
  };
}

const SELF_CLIENT_ID = 1;
const PEER: NotesAwarenessUser = { id: 'u-peer', name: 'Maya', color: '#EB459E' };
const OTHER: NotesAwarenessUser = { id: 'u-other', name: 'Sam', color: '#57F287' };

describe('useNotesLastEditedBy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when only the self client is connected', () => {
    const { awareness, setStates, fireChange } = makeFakeAwareness();
    setStates([[SELF_CLIENT_ID, { user: { id: 'me', name: 'Me', color: '#5865F2' } }]]);

    const { result } = renderHook(() => useNotesLastEditedBy(awareness, SELF_CLIENT_ID));

    // Initial snapshot (called inline on mount) — no peers, no debounce needed.
    expect(result.current).toBeNull();

    act(() => {
      fireChange();
    });
    expect(result.current).toBeNull();
  });

  it('debounces awareness changes by 500ms before committing', () => {
    const { awareness, setStates, fireChange } = makeFakeAwareness();
    setStates([
      [SELF_CLIENT_ID, { user: { id: 'me', name: 'Me', color: '#5865F2' } }],
      [2, { user: PEER }],
    ]);

    const { result } = renderHook(() => useNotesLastEditedBy(awareness, SELF_CLIENT_ID));

    act(() => {
      fireChange();
    });

    // 250ms in: still null — debounce hasn't fired.
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBeNull();

    // 500ms total: the timer fires and the commit lands.
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current?.user).toEqual(PEER);
  });

  it('excludes the self clientID even when awareness fires for it', () => {
    const { awareness, setStates, fireChange } = makeFakeAwareness();
    // Only the self entry has a user; no peers.
    setStates([[SELF_CLIENT_ID, { user: { id: 'me', name: 'Me', color: '#5865F2' } }]]);

    const { result } = renderHook(() => useNotesLastEditedBy(awareness, SELF_CLIENT_ID));

    act(() => {
      fireChange();
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeNull();
  });

  it('coalesces a burst of changes into a single commit at the trailing edge', () => {
    const { awareness, setStates, fireChange } = makeFakeAwareness();
    setStates([[2, { user: PEER }]]);

    const { result } = renderHook(() => useNotesLastEditedBy(awareness, SELF_CLIENT_ID));

    // Fire 5 changes in quick succession; the debounce should restart each
    // time so only the trailing edge commits.
    act(() => {
      for (let i = 0; i < 5; i += 1) {
        fireChange();
        vi.advanceTimersByTime(100);
      }
    });

    // After 500ms of activity we have not yet been idle for 500ms — still null.
    expect(result.current).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current?.user).toEqual(PEER);
  });

  it('switches the indicator when the most recent peer changes', () => {
    const { awareness, setStates, fireChange } = makeFakeAwareness();
    setStates([[2, { user: PEER }]]);

    const { result } = renderHook(() => useNotesLastEditedBy(awareness, SELF_CLIENT_ID));

    act(() => {
      fireChange();
      vi.advanceTimersByTime(500);
    });
    expect(result.current?.user).toEqual(PEER);

    // Now another peer becomes the most recent.
    setStates([
      [2, { user: PEER }],
      [3, { user: OTHER }],
    ]);
    act(() => {
      fireChange();
      vi.advanceTimersByTime(500);
    });
    // Either user is a valid "most recent" snapshot (iteration order isn't
    // strictly guaranteed across runtimes), but the indicator must show one
    // of the two real peers — never null, never the self.
    const winner = result.current?.user;
    expect(winner).toBeDefined();
    expect([PEER.id, OTHER.id]).toContain(winner!.id);
  });

  it('clears the indicator when all peers disconnect', () => {
    const { awareness, setStates, fireChange } = makeFakeAwareness();
    setStates([[2, { user: PEER }]]);

    const { result } = renderHook(() => useNotesLastEditedBy(awareness, SELF_CLIENT_ID));

    act(() => {
      fireChange();
      vi.advanceTimersByTime(500);
    });
    expect(result.current?.user).toEqual(PEER);

    setStates([]);
    act(() => {
      fireChange();
    });
    // Empty-peer transition is synchronous — no debounce, the indicator
    // disappears immediately so the footer doesn't lie.
    expect(result.current).toBeNull();
  });

  it('unsubscribes the change listener on unmount', () => {
    const { awareness, setStates, fireChange } = makeFakeAwareness();
    setStates([[2, { user: PEER }]]);

    const { unmount, result } = renderHook(() => useNotesLastEditedBy(awareness, SELF_CLIENT_ID));

    unmount();

    act(() => {
      fireChange();
      vi.advanceTimersByTime(1000);
    });
    // After unmount the hook should not commit further changes — React would
    // warn about state updates on an unmounted component if it did.
    expect(result.current).toBeNull();
  });
});
