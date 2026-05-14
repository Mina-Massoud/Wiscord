import { useAuth } from '@/hooks/useAuth';
import { CalendarShell } from '@/components/calendar/CalendarShell';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { UserPanel } from '@/components/app-shell/UserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

/**
 * Personal calendar — the user's own study planner.
 *
 * Lives outside the labs tree because it's a top-level surface, not a
 * sandbox. Mounts inside the same `AppShellLayout` chrome as every other
 * primary surface (voice / quiz / whiteboard) so the visual rhythm of the
 * shell stays consistent across the product.
 */
export default function CalendarPage(): React.JSX.Element {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <div className="bg-canvas text-ink flex min-h-screen items-center justify-center p-8">
        <p className="text-ink-muted text-body">Loading your profile…</p>
      </div>
    );
  }

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title="Calendar" />}
      serverRail={<ServerRail />}
      userPanel={<UserPanel />}
      main={
        <div className="flex min-h-0 flex-1">
          <CalendarShell channelId={null} ownerId={profile.id} />
        </div>
      }
      rightRail={<ActiveNowPanel />}
      forceRightRailExpanded
    />
  );
}
