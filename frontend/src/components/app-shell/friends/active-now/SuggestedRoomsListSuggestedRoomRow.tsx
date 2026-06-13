import { NavLink } from 'react-router';
import { Users } from 'lucide-react';

import { getIdenticonDataUrl } from '@/lib/avatar';
import type { DiscoverServerDto } from '@/queries/servers';

interface SuggestedRoomRowProps {
  server: DiscoverServerDto;
}

export function SuggestedRoomRow({ server }: SuggestedRoomRowProps): React.JSX.Element {
  const iconSrc = server.iconUrl ?? getIdenticonDataUrl(server.id);
  const memberLabel = `${server.memberCount} ${server.memberCount === 1 ? 'member' : 'members'}`;
  // Land in the first text channel when known; otherwise the server home route
  // resolves it (and redirects to the first channel once channels load).
  const to = server.firstChannelId
    ? `/app/servers/${server.id}/channels/${server.firstChannelId}`
    : `/app/servers/${server.id}`;

  return (
    <NavLink
      to={to}
      className="text-ink-muted hover:bg-glass-hover hover:text-ink mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors"
    >
      <img
        src={iconSrc}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-md"
        loading="lazy"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
        <span className="text-control truncate font-medium">{server.name}</span>
        <span className="text-ink-subtle text-caption flex items-center gap-1">
          <Users className="size-3 shrink-0" aria-hidden />
          {server.blurb ?? memberLabel}
        </span>
      </span>
    </NavLink>
  );
}
