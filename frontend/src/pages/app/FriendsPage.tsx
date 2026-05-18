import { useState } from 'react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { DmSidebar } from '@/components/app-shell/friends/DmSidebar';
import { FriendsContent } from '@/components/app-shell/friends/FriendsContent';
import { FriendsTopBar, type FriendsTab } from '@/components/app-shell/friends/FriendsTopBar';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';
import { useFriendRealtime, useIncomingFriendRequests } from '@/queries/friends';

/**
 * Default landing for /app. Owns the active-tab state so the top bar can
 * span the main pane + Active Now rail. Mounts `useFriendRealtime` once so
 * incoming requests / removals invalidate cache without a refresh.
 */
export default function FriendsPage(): React.JSX.Element {
  const [tab, setTab] = useState<FriendsTab>('online');
  useFriendRealtime();
  const incoming = useIncomingFriendRequests();
  const pendingCount = incoming.data?.length ?? 0;

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title="Friends" />}
      serverRail={<ServerRail />}
      sidebar={<DmSidebar />}
      userPanel={<GlobalUserPanel />}
      topBar={<FriendsTopBar activeTab={tab} pendingCount={pendingCount} onTabChange={setTab} />}
      main={<FriendsContent activeTab={tab} onTabChange={setTab} />}
      rightRail={<ActiveNowPanel />}
    />
  );
}
