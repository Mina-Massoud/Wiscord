import { create } from 'zustand';

export type SettingsTab =
  | 'myAccount'
  | 'profiles'
  | 'privacy'
  | 'security'
  | 'subscription'
  | 'billing'
  | 'voice'
  | 'appearance'
  | 'integrations';

interface SettingsStore {
  isOpen: boolean;
  activeTab: SettingsTab;
  open: (tab?: SettingsTab) => void;
  close: () => void;
  setTab: (tab: SettingsTab) => void;
}

/**
 * Drives the global User Settings dialog. Single source so the gear icon,
 * keyboard shortcuts, and deep links can all flip the same state without a
 * Context — and the dialog lives at the App root, not inside the user panel,
 * so closing it doesn't unmount any in-flight forms inside the dialog.
 */
export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  activeTab: 'myAccount',
  open: (tab) => set({ isOpen: true, ...(tab ? { activeTab: tab } : {}) }),
  close: () => set({ isOpen: false }),
  setTab: (tab) => set({ activeTab: tab }),
}));
