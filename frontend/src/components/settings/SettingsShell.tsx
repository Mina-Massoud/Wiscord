import { useEffect, useRef } from 'react';
import { LogOut, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/lib/toast';
import { useSettingsStore, type SettingsTab } from '@/lib/settings-store';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MyAccountPanel } from './panels/MyAccountPanel';
import { ProfilesPanel } from './panels/ProfilesPanel';
import { VoicePanel } from './panels/VoicePanel';
import { AppearancePanel } from './panels/AppearancePanel';
import { PrivacyPanel } from './panels/PrivacyPanel';
import { SecurityPanel } from './panels/SecurityPanel';
import { SubscriptionPanel } from './panels/SubscriptionPanel';
import { BillingPanel } from './panels/BillingPanel';
import { IntegrationsPanel } from './panels/IntegrationsPanel';

interface NavGroup {
  label: string;
  items: Array<{ key: SettingsTab; label: string }>;
}

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

function SettingsSidebar(): React.JSX.Element {
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

interface SidebarGroupProps {
  group: NavGroup;
}

function SidebarGroup({ group }: SidebarGroupProps): React.JSX.Element {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const setTab = useSettingsStore((s) => s.setTab);

  return (
    <div className="mb-4">
      <h3 className="text-ink-subtle text-badge mb-1 px-3 font-bold tracking-wider uppercase">
        {group.label}
      </h3>
      <ul className="flex flex-col">
        {group.items.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  'text-control w-full rounded-md px-3 py-1.5 text-left transition-colors',
                  isActive
                    ? 'bg-glass-active text-ink'
                    : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
                )}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SettingsPane(): React.JSX.Element {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const close = useSettingsStore((s) => s.close);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll when switching tabs — feels less like a browser route swap
  // and more like opening a fresh panel.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab]);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      <div className="absolute top-4 right-4 z-10 flex flex-col items-center">
        <button
          type="button"
          onClick={close}
          aria-label="Close settings"
          className="border-glass-border text-ink-muted hover:text-ink hover:border-ink-muted flex size-9 items-center justify-center rounded-full border-2 transition-colors"
        >
          <X className="size-4" />
        </button>
        <span className="text-ink-subtle text-badge mt-1 font-bold tracking-wider">ESC</span>
      </div>
      <div ref={scrollRef} className="bg-canvas flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[740px] px-10 py-16">
          {activeTab === 'myAccount' ? <MyAccountPanel /> : null}
          {activeTab === 'profiles' ? <ProfilesPanel /> : null}
          {activeTab === 'privacy' ? <PrivacyPanel /> : null}
          {activeTab === 'security' ? <SecurityPanel /> : null}
          {activeTab === 'subscription' ? <SubscriptionPanel /> : null}
          {activeTab === 'billing' ? <BillingPanel /> : null}
          {activeTab === 'integrations' ? <IntegrationsPanel /> : null}
          {activeTab === 'voice' ? <VoicePanel /> : null}
          {activeTab === 'appearance' ? <AppearancePanel /> : null}
        </div>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Reusable Discord-style section header. The big title at the top of the
 * pane uses `<h2>` and reads as the panel's title; subsequent sections
 * within the same panel use `<h3>` with a divider above.
 */
export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps): React.JSX.Element {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className="text-ink text-subhead font-semibold">{title}</h3>
      {description ? <p className="text-ink-muted text-control mt-1">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsPanelTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 className="text-ink text-display font-bold">{children}</h2>;
}

export function SettingsDivider(): React.JSX.Element {
  return <hr className="my-8 border-white/5" />;
}
