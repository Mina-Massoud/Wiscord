import { Link } from 'react-router';
import { CalendarDays } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

/**
 * DEV-only labs index for the calendar surface. Real channels-aware
 * routing replaces this once the channels module ships. For now this is
 * a thin signpost so the in-progress feature is reachable in dev.
 */
export default function CalendarIndexPage(): React.JSX.Element {
  return (
    <AppShellLayout
      titleBar={<AppTitleBar title="Calendar — labs" />}
      serverRail={<ServerRail />}
      userPanel={<GlobalUserPanel />}
      main={
        <div className="bg-glass-canvas flex h-full flex-col items-center justify-center gap-6 px-8 py-16">
          <div className="bg-glass-surface-1 text-ink-muted rounded-pill flex size-14 items-center justify-center">
            <CalendarDays className="size-6" aria-hidden />
          </div>
          <div className="max-w-md space-y-1 text-center">
            <h1 className="text-subhead text-ink font-semibold">Calendar — labs</h1>
            <p className="text-caption text-ink-muted">
              The personal study calendar lives at <code>/app/calendar</code>. Channel calendars
              will appear here once the channels module ships.
            </p>
          </div>
          <Link
            to="/app/calendar"
            className="text-control text-blurple hover:text-blurple-hover transition-colors"
          >
            Open my calendar →
          </Link>
        </div>
      }
      rightRail={<ActiveNowPanel />}
      forceRightRailExpanded
    />
  );
}
