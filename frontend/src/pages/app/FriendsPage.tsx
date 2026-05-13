import { useState } from 'react';
import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { UserPanel } from '@/components/app-shell/UserPanel';
import { DmSidebar } from '@/components/app-shell/friends/DmSidebar';
import { FriendsContent } from '@/components/app-shell/friends/FriendsContent';
import { FriendsTopBar, type FriendsTab } from '@/components/app-shell/friends/FriendsTopBar';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

/**
 * Default landing for /app. Static — no backend reads except the auth profile.
 * Owns the friends tab state so the tab strip can sit in the shell's top bar
 * (spanning the main pane + the Active Now rail).
 */
export default function FriendsPage(): React.JSX.Element {
  const [tab, setTab] = useState<FriendsTab>('online');

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title="Friends" />}
      serverRail={<ServerRail />}
      sidebar={<DmSidebar />}
      userPanel={<UserPanel />}
      topBar={<FriendsTopBar activeTab={tab} suggestionsCount={32} onTabChange={setTab} />}
      main={<FriendsContent activeTab={tab} />}
      rightRail={<ActiveNowPanel />}
    />
  );
}
