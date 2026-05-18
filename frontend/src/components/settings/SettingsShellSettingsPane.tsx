import { useSettingsStore } from '@/lib/settings-store';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { MyAccountPanel } from './panels/MyAccountPanel';
import { ProfilesPanel } from './panels/ProfilesPanel';
import { PrivacyPanel } from './panels/PrivacyPanel';
import { SecurityPanel } from './panels/SecurityPanel';
import { SubscriptionPanel } from './panels/SubscriptionPanel';
import { BillingPanel } from './panels/BillingPanel';
import { IntegrationsPanel } from './panels/IntegrationsPanel';
import { VoicePanel } from './panels/VoicePanel';
import { AppearancePanel } from './panels/AppearancePanel';

export function SettingsPane(): React.JSX.Element {
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
