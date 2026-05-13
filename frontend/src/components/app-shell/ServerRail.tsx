import { useParams } from 'react-router';
import { Compass, Download, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { fakeServers } from '@/data/fake-shell';
import { ServerRailIcon } from './ServerRailIcon';

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

function HomeGlyph(): React.JSX.Element {
  return (
    <img
      src="/logo/logo-white-bot-face.webp"
      alt=""
      width={32}
      height={32}
      loading="eager"
      fetchPriority="high"
      className="size-full object-contain"
    />
  );
}

function Separator(): React.JSX.Element {
  return <span aria-hidden className="bg-surface-hover my-1 h-0.5 w-8 rounded-full" />;
}

interface RailActionIconProps {
  label: string;
  icon: React.ReactNode;
  /** Color the icon turns on hover. */
  accent: 'online' | 'blurple';
}

function RailActionIcon({ label, icon, accent }: RailActionIconProps): React.JSX.Element {
  return (
    <div className="group relative flex h-10 w-full items-center justify-center">
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Link
            to="#"
            onClick={(e) => e.preventDefault()}
            aria-label={label}
            className={cn(
              'bg-surface-1 duration-base ease-wiscord flex size-8 items-center justify-center transition-[border-radius,background-color,color]',
              'rounded-full group-hover:rounded-md',
              accent === 'online'
                ? 'text-presence-online group-hover:bg-presence-online group-hover:text-white'
                : 'text-blurple group-hover:bg-blurple group-hover:text-white',
            )}
          >
            {icon}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
