import { NavLink } from 'react-router';
import { Users } from 'lucide-react';

import { getIdenticonDataUrl } from '@/lib/avatar';
import type { DiscoverServerDto } from '@/queries/servers';

interface DiscoverServerCardProps {
  server: DiscoverServerDto;
}

/**
 * One public server tile on the Discover page. Clicking lands in the server's
 * first text channel (membership is created on first visit), or the server
 * home route when it has no text channel yet.
 */
export function DiscoverServerCard({ server }: DiscoverServerCardProps): React.JSX.Element {
  const iconSrc = server.iconUrl ?? getIdenticonDataUrl(server.id);
  const memberLabel = `${server.memberCount} ${server.memberCount === 1 ? 'member' : 'members'}`;
  const to = server.firstChannelId
    ? `/app/servers/${server.id}/channels/${server.firstChannelId}`
    : `/app/servers/${server.id}`;

  return (
    <NavLink
      to={to}
      className="bg-glass-surface-1 border-glass-border hover:border-glass-border-strong flex items-center gap-3 rounded-lg border p-4 transition-colors"
    >
      <img
        src={iconSrc}
        alt=""
        width={48}
        height={48}
        className="size-12 shrink-0 rounded-md"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <h3 className="text-ink text-subhead truncate font-semibold">{server.name}</h3>
        <p className="text-ink-subtle text-caption mt-0.5 flex items-center gap-1">
          <Users className="size-3 shrink-0" aria-hidden />
          {server.blurb ?? memberLabel}
        </p>
      </div>
    </NavLink>
  );
}
