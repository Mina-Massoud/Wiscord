import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';

/**
 * Awareness payload each client publishes on connect. Mirrors the shape
 * `NotesEditor` writes via `provider.setAwarenessField('user', …)`.
 */
export interface NotesAwarenessUser {
  id: string;
  name: string;
  color: string;
}

export interface NotesLastEditedBy {
  user: NotesAwarenessUser;
  /** Monotonic ms — when this user last changed their awareness state. */
  at: number;
}

const ECHO_DEBOUNCE_MS = 500;

/**
 * Subscribe to the Yjs awareness map and surface the most recent non-self
 * editor as a stable "last edited by" indicator.
 *
 * Awareness fires on every cursor blink and pointer twitch — raw subscription
 * would flicker the indicator constantly. We debounce updates so a switch
 * between editors lands ~500ms after the last burst settles, which feels
 * "alive but not chattery" in practice.
 */
export function useNotesLastEditedBy(
  awareness: Awareness | null,
  selfClientId: number | null,
): NotesLastEditedBy | null {
  const [latest, setLatest] = useState<NotesLastEditedBy | null>(null);

  useEffect(() => {
    if (!awareness) return;

    let pendingTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingValue: NotesLastEditedBy | null = null;

    const commit = (): void => {
      pendingTimer = null;
      if (pendingValue) setLatest(pendingValue);
    };

    const handleChange = (): void => {
      const states = awareness.getStates();
      let best: NotesLastEditedBy | null = null;
      const now = Date.now();
      for (const [clientId, state] of states) {
        if (clientId === selfClientId) continue;
        const user = (state as { user?: NotesAwarenessUser }).user;
        if (!user?.id || !user.name) continue;
        // We don't have a per-user lastEdit timestamp on the wire, so the
        // commit time stamps "we observed this user just now". Multiple
        // active users → the most recently-firing change wins because each
        // handleChange overwrites `pendingValue`.
        best = { user, at: now };
      }
      // Drop if no other user is connected.
      if (!best) {
        if (pendingTimer) clearTimeout(pendingTimer);
        pendingTimer = null;
        pendingValue = null;
        setLatest(null);
        return;
      }
      pendingValue = best;
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(commit, ECHO_DEBOUNCE_MS);
    };

    awareness.on('change', handleChange);
    // Pull an initial snapshot so we don't sit on `null` if peers are
    // already connected when the editor mounts.
    handleChange();

    return () => {
      awareness.off('change', handleChange);
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [awareness, selfClientId]);

  return latest;
}
