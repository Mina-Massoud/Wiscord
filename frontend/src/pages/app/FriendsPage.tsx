import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/server/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { DmSidebar } from '@/components/app-shell/friends/DmSidebar';
import { FriendsContent } from '@/components/app-shell/friends/FriendsContent';
import { FriendsTopBar, type FriendsTab } from '@/components/app-shell/friends/FriendsTopBar';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';
import { useFriendRealtime, useIncomingFriendRequests } from '@/queries/friends';

const FRIENDS_TABS: FriendsTab[] = ['online', 'all', 'pending', 'add'];

function parseTab(value: string | null): FriendsTab {
  return value && (FRIENDS_TABS as string[]).includes(value) ? (value as FriendsTab) : 'online';
}

/**
 * Default landing for /app. The active tab lives in the URL (`?tab=`) so the
 * DM sidebar's "Inbox" link can deep-link straight to pending requests and the
 * tab survives a reload. Mounts `useFriendRealtime` once so incoming requests /
 * removals invalidate cache without a refresh.
 */
export default function FriendsPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));

  const setTab = useCallback(
    (next: FriendsTab): void => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'online') params.delete('tab');
          else params.set('tab', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

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
