import { Inbox, Compass, Users, Plus } from 'lucide-react';

import { fakeRecentRooms } from '@/data/fake-shell';
import { SidebarNavRow } from './SidebarNavRow';
import { RoomRow } from './RoomRow';

/**
 * Friends-mode left column (channel-list aside).
 * Top: pill search ("Find a study buddy or session").
 * Then two categorized nav groups:
 *   SOCIAL  — Friends, Inbox
 *   EXPLORE — Find a study room, Start your own
 * Then: "Recent rooms" header + the room list (channels you've recently
 * been in, across all your servers). Discord-style 1:1 DMs are explicitly
 * out of scope in v1 (see docs/overview.md) — this list surfaces *rooms*.
 * The bottom user-identity pill is rendered separately by the shell so it
 * can span both the server rail and this sidebar.
 */
export function DmSidebar(): React.JSX.Element {
  return (
    <>
      <div className="px-2 pt-2">
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          className="bg-glass-callout border-glass-border text-ink-subtle text-caption hover:bg-glass-hover h-7 w-full rounded border px-2 text-left font-medium transition-colors"
        >
          Find a study buddy or session
        </button>
      </div>

      <SidebarSectionHeader label="Social" />
      <nav aria-label="Social" className="flex flex-col gap-0.5">
        <SidebarNavRow
          to="/app"
          end
          label="Friends"
          icon={<Users className="size-5" />}
          forceActive
        />
        <SidebarNavRow to="/app/inbox" label="Inbox" icon={<Inbox className="size-5" />} />
      </nav>

      <SidebarSectionHeader label="Explore" />
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

      <div className="mt-4 flex items-center justify-between px-4 pb-1">
        <span className="text-ink-subtle text-badge font-bold tracking-wider uppercase">
          Recent rooms
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        <div className="cv-auto flex flex-col gap-0.5">
          {fakeRecentRooms.map((room) => (
            <RoomRow key={room.id} room={room} />
          ))}
        </div>
      </div>
    </>
  );
}

interface SidebarSectionHeaderProps {
  label: string;
}

function SidebarSectionHeader({ label }: SidebarSectionHeaderProps): React.JSX.Element {
  return (
    <div className="mt-4 px-4 pb-1">
      <span className="text-ink-subtle text-badge font-bold tracking-wider uppercase">{label}</span>
    </div>
  );
}
