import { useParams } from 'react-router';
import { Compass, Download, Plus } from 'lucide-react';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { fakeServers } from '@/data/fake-shell';
import { ServerRailIcon } from './ServerRailIcon';
import { HomeGlyph } from './ServerRailHomeGlyph';
import { Separator } from './ServerRailSeparator';
import { RailActionIcon } from './ServerRailRailActionIcon';

/**
 * Persistent 72px left rail. Reads :serverId from the URL to mark the active server.
 * When no :serverId param is present (i.e. /app), the "Home" tile is active.
 */
export function ServerRail(): React.JSX.Element {
  const { serverId } = useParams<{ serverId?: string }>();
  const isHomeActive = !serverId;

  return (
    <nav className="flex h-full flex-col items-center gap-1.5 overflow-y-auto px-3 py-3">
      <ServerRailIcon
        to="/app"
        label="Friends & recent rooms"
        isActive={isHomeActive}
        tileClassName="bg-blurple"
      >
        <HomeGlyph />
      </ServerRailIcon>

      <Separator />

      {fakeServers.map((server) => (
        <ServerRailIcon
          key={server.id}
          to={`/app/servers/${server.id}`}
          label={server.name}
          isActive={serverId === server.id}
          hasUnread={server.hasUnread}
          unreadCount={server.unreadCount}
          avatarSrc={getIdenticonDataUrl(server.iconSeed)}
        />
      ))}

      <RailActionIcon label="Add a Server" icon={<Plus className="size-5" />} accent="online" />
      <RailActionIcon label="Explore" icon={<Compass className="size-5" />} accent="online" />

      <Separator />

      <RailActionIcon
        label="Download Apps"
        icon={<Download className="size-5" />}
        accent="online"
      />
    </nav>
  );
}

// ─── Sub-pieces ─────────────────────────────────────────────────────────────
