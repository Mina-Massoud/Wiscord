import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Compass, Download, Plus } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { serverIconSrc } from '@/lib/server-display';
import { useMyServers, useServersUnread } from '@/queries/servers';
import { ServerRailIcon } from './ServerRailIcon';
import { ServerRailHomeGlyph } from './ServerRailHomeGlyph';
import { ServerRailSeparator } from './ServerRailSeparator';
import { ServerRailRailActionIcon } from './ServerRailRailActionIcon';
import { CreateServerDialog } from './CreateServerDialog';

/**
 * Persistent 72px left rail — lists real servers from GET /servers.
 */
export function ServerRail(): React.JSX.Element {
  const { serverId } = useParams<{ serverId?: string }>();
  const navigate = useNavigate();
  const isHomeActive = !serverId;
  const { data: servers, isLoading, isError } = useMyServers();
  const { data: unreadData } = useServersUnread();
  const [createOpen, setCreateOpen] = useState(false);

  const unreadMap = new Map<string, { hasUnread: boolean; unreadCount: number }>();
  if (unreadData) {
    for (const u of unreadData) {
      unreadMap.set(u.serverId, { hasUnread: u.hasUnread, unreadCount: u.unreadCount });
    }
  }

  return (
    <nav className="flex h-full flex-col items-center gap-1.5 overflow-y-auto px-3 py-3">
      <ServerRailIcon
        to="/app"
        label="Friends & recent rooms"
        isActive={isHomeActive}
        tileClassName="bg-blurple"
      >
        <ServerRailHomeGlyph />
      </ServerRailIcon>

      <ServerRailSeparator />

      {isLoading
        ? Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="size-8 shrink-0 rounded-full" aria-hidden />
          ))
        : null}

      {!isLoading && !isError
        ? (servers ?? []).map((server) => {
            const unread = unreadMap.get(server.id);
            return (
              <ServerRailIcon
                key={server.id}
                to={`/app/servers/${server.id}`}
                label={server.name}
                isActive={serverId === server.id}
                avatarSrc={serverIconSrc(server)}
                hasUnread={unread?.hasUnread ?? false}
                unreadCount={unread?.unreadCount ?? 0}
              />
            );
          })
        : null}

      <ServerRailRailActionIcon
        label="Add a Server"
        icon={<Plus className="size-5" />}
        accent="online"
        onClick={() => setCreateOpen(true)}
      />
      <CreateServerDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ServerRailRailActionIcon
        label="Explore"
        icon={<Compass className="size-5" />}
        accent="online"
        onClick={() => void navigate('/app/discover')}
      />

      <ServerRailSeparator />

      <ServerRailRailActionIcon
        label="Download Apps"
        icon={<Download className="size-5" />}
        accent="online"
      />
    </nav>
  );
}
