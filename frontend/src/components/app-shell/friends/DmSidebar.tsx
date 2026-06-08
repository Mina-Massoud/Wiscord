import { Inbox, Compass, Users, Plus } from 'lucide-react';
import { useLocation } from 'react-router';

import { fakeRecentRooms } from '@/data/fake-shell';
import { SidebarNavRow } from './SidebarNavRow';
import { RoomRow } from './RoomRow';
import { useDms } from '@/queries/dms';
import { DmRoomRow } from './DmRoomRow';
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
  const location = useLocation();

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
              forceActive={location.pathname === '/app'}
            />
            <SidebarNavRow to="/app/inbox" label="Inbox" icon={<Inbox className="size-5" />} />
          </nav>
        </Sidebar.Section>

        <Sidebar.Section title="Explore">
          <nav aria-label="Explore" className="flex flex-col gap-0.5">
            <SidebarNavRow
              to="/app/discover"
              label="Find a study room"
              icon={<Compass className="size-5" />}
            />
            <SidebarNavRow
              to="/app/create-server"
              label="Start your own"
              icon={<Plus className="size-5" />}
            />
          </nav>
        </Sidebar.Section>

        <Sidebar.Section title="Direct Messages">
          <div className="flex flex-col gap-0.5">
            {dmRooms.length === 0 ? (
              <div className="text-ink-subtle px-2 py-1 text-xs">
                No direct messages yet.
              </div>
            ) : (
              dmRooms.map((room) => (
                <DmRoomRow key={room.id} room={room} />
              ))
            )}
          </div>
        </Sidebar.Section>

        <Sidebar.Section title="Recent rooms">
          <div className="flex flex-col gap-0.5">
            {fakeRecentRooms.map((room) => (
              <RoomRow key={room.id} room={room} />
            ))}
          </div>
        </Sidebar.Section>
      </Sidebar.Body>
    </Sidebar.Root>
  );
}
