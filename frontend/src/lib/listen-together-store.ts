import { create } from 'zustand';

import type {
  ListenTogetherInvite,
  ListenTogetherRole,
  ListenTogetherSession,
} from '@/types/listen-together';

/**
 * Sibling store to `music-player-store`. Holds the social/invite state for
 * listen-together — pending invites (incoming and outgoing) and the active
 * session. The two stores cooperate at the slot level:
 *
 *  - `incomingInvite` non-null → the music capsule renders one of the
 *    `invite-incoming-*` views.
 *  - `activeSession` non-null → the capsule renders the
 *    `listen-together-now-playing` view; the sync hook drives playback.
 *  - `sentInvite` non-null → the sharer's expanded view renders a
 *    "waiting on @alice" chip.
 *
 * Kept separate from the music player store so:
 *   - selectors stay scalar (no allocation traps),
 *   - audio state can move without dragging social state along,
 *   - the music capsule still works for users who never use the feature.
 */
interface ListenTogetherState {
  /** A friend has invited the current user; null when there is no pending ask. */
  incomingInvite: ListenTogetherInvite | null;
  /** The current user has invited a friend; null when nothing is in flight. */
  sentInvite: ListenTogetherInvite | null;
  /** Active session, regardless of role. null when not in a session. */
  activeSession: ListenTogetherSession | null;
  /** Caller's role in the active session. null when `activeSession` is null. */
  role: ListenTogetherRole | null;

  // ── Actions ──────────────────────────────────────────────────────────
  setIncomingInvite: (invite: ListenTogetherInvite | null) => void;
  setSentInvite: (invite: ListenTogetherInvite | null) => void;
  /**
   * Move from an invite (incoming or sent) to an active session. Clears any
   * lingering invite state in one shot so selectors don't briefly observe
   * both at once.
   */
  enterSession: (session: ListenTogetherSession, role: ListenTogetherRole) => void;
  /** Clears active session + role. Invites are NOT touched. */
  leaveSession: () => void;
  /** Force-clear everything — typically on sign-out. */
  reset: () => void;
}

const INITIAL: Pick<
  ListenTogetherState,
  'incomingInvite' | 'sentInvite' | 'activeSession' | 'role'
> = {
  incomingInvite: null,
  sentInvite: null,
  activeSession: null,
  role: null,
};

export const useListenTogetherStore = create<ListenTogetherState>((set) => ({
  ...INITIAL,
  setIncomingInvite: (invite) => set({ incomingInvite: invite }),
  setSentInvite: (invite) => set({ sentInvite: invite }),
  enterSession: (session, role) =>
    set({
      activeSession: session,
      role,
      incomingInvite: null,
      sentInvite: null,
    }),
  leaveSession: () => set({ activeSession: null, role: null }),
  reset: () => set({ ...INITIAL }),
}));

/** True when the caller has no live invite or session. Used as the gate for
 *  the music capsule's normal music views — when this is false, the capsule
 *  surfaces invite/session UI instead. */
export function isListenTogetherIdle(state: ListenTogetherState): boolean {
  return state.incomingInvite === null && state.sentInvite === null && state.activeSession === null;
}
