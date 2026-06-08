import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { MediaImg } from '@/components/ui/media-img';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PillIndicator } from '@/components/app-shell/atoms/PillIndicator';
import { UnreadBadge } from '@/components/app-shell/atoms/UnreadBadge';

interface ServerRailIconProps {
  to: string;
  label: string;
  isActive: boolean;
  hasUnread?: boolean;
  unreadCount?: number;
  avatarSrc?: string | null;
  initials?: string;
  tileClassName?: string;
  children?: React.ReactNode;
  end?: React.ReactNode;
}

export function ServerRailIcon({
  to,
  label,
  isActive,
  hasUnread = false,
  unreadCount,
  avatarSrc,
  initials,
  tileClassName,
  children,
  end,
}: ServerRailIconProps): React.JSX.Element {
  const showPill = isActive ? 'active' : hasUnread ? 'hover' : 'idle';

  return (
    <div className="group relative flex h-10 w-full items-center justify-center">
      <PillIndicator
        state={showPill}
        className="group-hover:h-5 group-hover:scale-y-100 group-hover:opacity-100"
      />

      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Link
            to={to}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'bg-glass-surface-1 text-ink relative flex size-8 items-center justify-center overflow-hidden',
              'duration-base ease-wiscord transition-[border-radius,background-color]',
              isActive
                ? 'bg-blurple rounded-md'
                : 'group-hover:bg-blurple rounded-full group-hover:rounded-md',
              tileClassName,
            )}
          >
            {avatarSrc ? (
              <MediaImg
                src={avatarSrc}
                alt=""
                width={32}
                height={32}
                className="size-full object-cover"
                loading="lazy"
              />
            ) : initials ? (
              <span className="text-control font-semibold tracking-tight uppercase">
                {initials}
              </span>
            ) : (
              children
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>

      {unreadCount && unreadCount > 0 ? (
        <span className="pointer-events-none absolute -right-0.5 -bottom-0.5">
          <UnreadBadge count={unreadCount} />
        </span>
      ) : end ? (
        <span className="pointer-events-none absolute -right-0.5 -bottom-0.5">{end}</span>
      ) : null}
    </div>
  );
}
