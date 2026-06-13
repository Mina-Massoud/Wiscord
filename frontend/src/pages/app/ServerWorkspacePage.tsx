import { useEffect, useRef } from 'react';
import { Calendar, Hash, Volume2 } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { PaneHeader } from '@/components/ui/pane-header';
import { ServerRail } from '@/components/server/ServerRail';
import { ServerChannelSidebar } from '@/components/server/ServerChannelSidebar';
import { ServerChannelMainPane } from '@/components/server/ServerChannelMainPane';
import { firstTextChannel, useServerChannels } from '@/queries/channels';
import { useServer } from '@/queries/servers';
import { useServerEvents } from '@/queries/events';
import { useServerEventsRealtime } from '@/hooks/useServerEventsRealtime';
import { useRecordRoomVisit } from '@/hooks/useRecordRoomVisit';
import { toast } from '@/lib/toast';
import { EventsView } from '@/components/events/EventsView';

/**
 * Server workspace — channel sidebar (text + voice) and a main pane per channel.
 * Bare `/app/servers/:serverId` redirects into the first text channel once channels load.
 */
export default function ServerWorkspacePage(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { serverId, channelId } = useParams<{ serverId: string; channelId?: string }>();

  const serverQuery = useServer(serverId);
  const channelsQuery = useServerChannels(serverId);

  // Real-time events cache sync
  useServerEventsRealtime(serverId);
  const eventsQuery = useServerEvents(serverId);

  const channels = channelsQuery.data;
  const activeChannel = channels?.find((c) => c.id === channelId);
  const isEventsPage = location.pathname.endsWith('/events');

  // Persist this visit into the recent-rooms rail once the channel resolves.
  useRecordRoomVisit(
    activeChannel && serverId
      ? {
          serverId,
          channelId: activeChannel.id,
          serverName: serverQuery.data?.name ?? activeChannel.name,
          serverIconUrl: serverQuery.data?.iconUrl ?? null,
          channelName: activeChannel.name,
          channelType: activeChannel.type,
        }
      : null,
  );

  useEffect(() => {
    const list = channelsQuery.data;
    if (!serverId || channelId || isEventsPage || channelsQuery.isLoading || !list?.length) return;
    const text = firstTextChannel(list);
    if (text) {
      void navigate(`/app/servers/${serverId}/channels/${text.id}`, { replace: true });
    }
  }, [serverId, channelId, channelsQuery.data, channelsQuery.isLoading, navigate, isEventsPage]);

  // Alert server members when an event is starting soon (in less than 5 minutes)
  const notifiedEventsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!serverId || !eventsQuery.data) return;

    const checkUpcomingEvents = () => {
      const now = new Date().getTime();
      const fiveMinutesFromNow = now + 5 * 60 * 1000;

      eventsQuery.data.forEach((event) => {
        if (event.status !== 'scheduled') return;
        const startTime = new Date(event.startsAt).getTime();

        // If starting in next 5 minutes and is future
        if (startTime > now && startTime <= fiveMinutesFromNow) {
          if (!notifiedEventsRef.current.has(event.id)) {
            notifiedEventsRef.current.add(event.id);
            toast.info(`"${event.title}" is starting soon!`, {
              description: `Starts at ${new Date(event.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Click Events to join.`,
            });
          }
        }
      });
    };

    checkUpcomingEvents();
    const intervalId = setInterval(checkUpcomingEvents, 30000); // check every 30 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [serverId, eventsQuery.data]);

  const topBarTitle = isEventsPage
    ? 'Events'
    : activeChannel
      ? activeChannel.type === 'text'
        ? `#${activeChannel.name}`
        : activeChannel.name
      : (serverQuery.data?.name ?? 'Server');

  const TopBarIcon = isEventsPage ? Calendar : activeChannel?.type === 'voice' ? Volume2 : Hash;

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title={serverQuery.data?.name ?? 'Server'} />}
      serverRail={<ServerRail />}
      sidebar={
        <ServerChannelSidebar
          server={serverQuery.data ?? undefined}
          channels={channels}
          isLoading={channelsQuery.isLoading || serverQuery.isLoading}
          isError={channelsQuery.isError || serverQuery.isError}
        />
      }
      userPanel={<GlobalUserPanel />}
      topBar={
        <PaneHeader
          variant="topbar"
          icon={<TopBarIcon className="text-ink-muted size-4 shrink-0" aria-hidden />}
          title={topBarTitle}
        />
      }
      main={
        isEventsPage ? (
          <EventsView serverId={serverId!} />
        ) : (
          <ServerChannelMainPane
            channel={activeChannel}
            isLoading={channelsQuery.isLoading && !channelId}
            isError={channelsQuery.isError}
            onRetry={() => void channelsQuery.refetch()}
          />
        )
      }
    />
  );
}
