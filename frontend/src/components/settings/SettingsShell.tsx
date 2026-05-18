import { useSettingsStore, type SettingsTab } from '@/lib/settings-store';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SettingsSidebar } from './SettingsShellSettingsSidebar';
import { SettingsPane } from './SettingsShellSettingsPane';
export { SettingsSection } from './SettingsShellSettingsSection';
export { SettingsPanelTitle } from './SettingsShellSettingsPanelTitle';
export { SettingsDivider } from './SettingsShellSettingsDivider';

export interface NavGroup {
  label: string;
  items: Array<{ key: SettingsTab; label: string }>;
}

/**
 * User Settings dialog. Two-column Discord-style layout:
 *   - Left rail: search (static for v1), grouped nav items, sign-out footer
 *   - Right pane: the active panel + a top-right ESC/× affordance
 *
 * Mounted once at the App root (see SettingsDialogRoot). State lives in
 * `useSettingsStore` so the gear icon, future keyboard shortcuts, and deep
 * links all flip the same source.
 */
export function SettingsShell(): React.JSX.Element {
  const isOpen = useSettingsStore((s) => s.isOpen);
  const close = useSettingsStore((s) => s.close);

  return (
    <Dialog open={isOpen} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent
        hideClose
        className="bg-canvas h-[95vh] w-[85vw] max-w-none gap-0 overflow-hidden border-0 p-0 sm:max-w-none"
      >
        <div className="flex h-full min-h-0">
          <SettingsSidebar />
          <SettingsPane />
        </div>
      </DialogContent>
    </Dialog>
  );
}
