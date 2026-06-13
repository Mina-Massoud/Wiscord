import { Compass } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/server/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { DmSidebar } from '@/components/app-shell/friends/DmSidebar';
import { PaneHeader } from '@/components/ui/pane-header';
import { DiscoverServerGrid } from '@/components/app-shell/discover/DiscoverServerGrid';

/**
 * `/app/discover` — browse and join public study servers. Reuses the friends
 * shell (server rail + DM sidebar) so navigation stays put; the main pane
 * lists public servers from discovery.
 */
export default function DiscoverPage(): React.JSX.Element {
  return (
    <AppShellLayout
      titleBar={<AppTitleBar title="Discover" />}
      serverRail={<ServerRail />}
      sidebar={<DmSidebar />}
      userPanel={<GlobalUserPanel />}
      topBar={
        <PaneHeader
          variant="topbar"
          icon={<Compass className="text-ink-muted size-4 shrink-0" aria-hidden />}
          title="Discover study rooms"
        />
      }
      main={<DiscoverServerGrid />}
    />
  );
}
