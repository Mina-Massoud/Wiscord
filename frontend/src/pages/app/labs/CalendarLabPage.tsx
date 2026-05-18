import { useParams } from 'react-router';

import { useAuth } from '@/hooks/useAuth';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import { funnyTitle } from '@/lib/funny-title';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

/**
 * DEV-only single-channel calendar surface. Mirrors the labs convention
 * used by notes / whiteboard / quiz — the real channel page will mount
 * `<CalendarShell>` as a tab once channels lands.
 */
export default function CalendarLabPage(): React.JSX.Element {
  const { channelId } = useParams<{ channelId: string }>();
  const { profile } = useAuth();
  const title = channelId ? funnyTitle(channelId) : '';

  if (!channelId) {
    return (
      <div className="bg-canvas text-ink flex min-h-screen items-center justify-center p-8">
        <p className="text-ink-muted text-body">No channel id in URL.</p>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="bg-canvas text-ink flex min-h-screen items-center justify-center p-8">
        <p className="text-ink-muted text-body">Loading your profile…</p>
      </div>
    );
  }

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title={`Calendar · ${title}`} />}
      serverRail={<ServerRail />}
      userPanel={<GlobalUserPanel />}
      main={
        <div className="flex min-h-0 flex-1">
          <CalendarShell channelId={channelId} ownerId={channelId} />
        </div>
      }
      rightRail={<ActiveNowPanel />}
      forceRightRailExpanded
    />
  );
}
