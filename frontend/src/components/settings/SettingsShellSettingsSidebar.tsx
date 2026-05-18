import { useAuth } from '@/hooks/useAuth';
import { useSettingsStore } from '@/lib/settings-store';
import { toast } from '@/lib/toast';
import { LogOut } from 'lucide-react';
import { SidebarGroup } from './SettingsShellSidebarGroup';
import type { NavGroup } from './SettingsShell';

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'User Settings',
    items: [
      { key: 'myAccount', label: 'My Account' },
      { key: 'profiles', label: 'Profiles' },
      { key: 'privacy', label: 'Privacy & Safety' },
      { key: 'security', label: 'Security' },
    ],
  },
  {
    label: 'Billing Settings',
    items: [
      { key: 'subscription', label: 'Subscription' },
      { key: 'billing', label: 'Billing History' },
    ],
  },
  {
    label: 'Connections',
    items: [{ key: 'integrations', label: 'Integrations' }],
  },
  {
    label: 'App Settings',
    items: [
      { key: 'voice', label: 'Voice & Video' },
      { key: 'appearance', label: 'Appearance' },
    ],
  },
];

export function SettingsSidebar(): React.JSX.Element {
  const { signOut } = useAuth();
  const close = useSettingsStore((s) => s.close);

  async function handleSignOut(): Promise<void> {
    try {
      close();
      await signOut();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Could not sign out.';
      toast.error(message);
    }
  }

  return (
    <aside className="bg-surface-1 flex w-60 shrink-0 flex-col">
      <div className="px-3 pt-4">
        <input
          type="search"
          placeholder="Search"
          aria-label="Search settings"
          className="bg-canvas text-ink text-control placeholder:text-ink-subtle focus:border-blurple h-8 w-full rounded-md border border-white/5 px-3 focus:outline-none"
        />
      </div>
      <nav aria-label="Settings sections" className="flex-1 overflow-y-auto px-3 pt-4 pb-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} group={group} />
        ))}
      </nav>
      <div className="border-glass-border border-t p-3">
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-destructive hover:bg-glass-hover text-control flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
