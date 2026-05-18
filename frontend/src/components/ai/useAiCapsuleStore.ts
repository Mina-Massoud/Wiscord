import { create } from 'zustand';

/**
 * State for the AI capsule. Mirrors `useIslandStore` shape so any
 * surface (settings rows, future hotkeys) can flip the capsule
 * open from anywhere.
 *
 * `openSource` drives the horizontal expansion into the source
 * pane (Phase 5). When non-null the capsule morphs to a wider
 * shape and renders the inline view (note plaintext / calendar
 * embed) alongside the chat list. `closeSource` keeps `expanded`
 * true so the capsule narrows back to chat-only without
 * collapsing the whole surface.
 */

export type AiCapsuleSourceRef =
  | { kind: 'note'; id: string; title: string }
  | {
      kind: 'event';
      id: string;
      title: string;
      /** ISO datetime — when set, the calendar pane opens in
       *  day-view scoped to this moment. Cited-event clicks set
       *  this so the user lands directly on the day in question. */
      startAt?: string;
    };

interface AiCapsuleStore {
  expanded: boolean;
  openSource: AiCapsuleSourceRef | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  openSourcePane: (source: AiCapsuleSourceRef) => void;
  closeSourcePane: () => void;
}

export const useAiCapsuleStore = create<AiCapsuleStore>((set) => ({
  expanded: false,
  openSource: null,
  open: () => set({ expanded: true }),
  close: () => set({ expanded: false, openSource: null }),
  toggle: () => set((state) => ({ expanded: !state.expanded })),
  openSourcePane: (source) => set({ expanded: true, openSource: source }),
  closeSourcePane: () => set({ openSource: null }),
}));
