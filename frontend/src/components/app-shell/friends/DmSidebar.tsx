import { useMemo, useState } from 'react';
import { Inbox, Compass, Users, Plus } from 'lucide-react';
import { useLocation } from 'react-router';

import { SidebarNavRow } from './SidebarNavRow';
import { SidebarNavButton } from './SidebarNavButton';
import { RoomRow } from './RoomRow';
import { useDms } from '@/queries/dms';
import { useMyServers } from '@/queries/servers';
import { useRecentRooms } from '@/lib/recent-rooms-store';
import { DmRoomRow } from './DmRoomRow';
import { CreateServerDialog } from '@/components/server/CreateServerDialog';
import { Sidebar } from '@/components/ui/sidebar-shell';

/**
 * Friends-mode left column (channel-list aside).
 * Top: Search pill.
 * Then categorized nav groups using standard Sidebar.Section:
 *   SOCIAL  — Friends, Inbox
 *   EXPLORE — Find a study room, Start your own
 *   DIRECT MESSAGES — Live DMs from useDms()
 *   RECENT ROOMS — Historical recent channels
 */
export function DmSidebar(): React.JSX.Element {
  const { data: dmRooms = [] } = useDms();
  const { data: servers = [] } = useMyServers();
  const recent = useRecentRooms();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);

  // "Friends" and "Inbox" both live at /app, differing only by the `?tab=`
  // search param, so we resolve their active state explicitly.
  const onFriends = location.pathname === '/app';
  const isPendingTab = new URLSearchParams(location.search).get('tab') === 'pending';

  // Drop recents whose server the user has since left/deleted — a stale row
  // that 404s on click reads as broken (failure-mode #4: orphaned entity).
  const visibleRecent = useMemo(() => {
    const knownServerIds = new Set(servers.map((s) => s.id));
    return recent.filter((r) => knownServerIds.has(r.serverId));
  }, [recent, servers]);

  return (
    <Sidebar.Root>
      <div className="px-2 pt-2 pb-2">
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          className="bg-glass-callout border-glass-border text-ink-subtle text-caption hover:bg-glass-hover h-7 w-full rounded border px-2 text-left font-medium transition-colors"
        >
          Find a study buddy or session
        </button>
      </div>

      <Sidebar.Body>
        <Sidebar.Section title="Social">
          <nav aria-label="Social" className="flex flex-col gap-0.5">
            <SidebarNavRow
              to="/app"
              end
              label="Friends"
              icon={<Users className="size-5" />}
              match={onFriends && !isPendingTab}
            />
            <SidebarNavRow
              to="/app?tab=pending"
              label="Inbox"
              icon={<Inbox className="size-5" />}
              match={onFriends && isPendingTab}
            />
          </nav>
        </Sidebar.Section>

        <Sidebar.Section title="Explore">
          <nav aria-label="Explore" className="flex flex-col gap-0.5">
            <SidebarNavRow
              to="/app/discover"
              label="Find a study room"
              icon={<Compass className="size-5" />}
            />
            <SidebarNavButton
              label="Start your own"
              icon={<Plus className="size-5" />}
              onClick={() => setCreateOpen(true)}
            />
          </nav>
        </Sidebar.Section>

        <Sidebar.Section title="Direct Messages">
          <div className="flex flex-col gap-0.5">
            {dmRooms.length === 0 ? (
              <div className="text-ink-subtle px-2 py-1 text-xs">No direct messages yet.</div>
            ) : (
              dmRooms.map((room) => <DmRoomRow key={room.id} room={room} />)
            )}
          </div>
        </Sidebar.Section>

        <Sidebar.Section title="Recent rooms">
          <div className="flex flex-col gap-0.5">
            {visibleRecent.length === 0 ? (
              <div className="text-ink-subtle px-2 py-1 text-xs">
                No recent rooms yet. Jump into a channel to see it here.
              </div>
            ) : (
              visibleRecent.map((room) => <RoomRow key={room.channelId} room={room} />)
            )}
          </div>
        </Sidebar.Section>
      </Sidebar.Body>

      <CreateServerDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Sidebar.Root>
  );
}
