import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PillIndicator } from './atoms/PillIndicator';
import { UnreadBadge } from './atoms/UnreadBadge';

interface ServerRailIconProps {
  to: string;
  label: string;
  /** When true, renders the active pill and squircle shape. */
  isActive: boolean;
  hasUnread?: boolean;
  unreadCount?: number;
  /** Avatar image data URL (identicon) or null to render initials. */
  avatarSrc?: string | null;
  /** Two-char fallback when no avatar. */
  initials?: string;
  /** Override class on the rounded button — used by the Home button. */
  tileClassName?: string;
  children?: React.ReactNode;
}

/**
 * Single icon in the 72px-wide server rail.
 * Morphs from full circle (idle) → squircle (hover/active).
 * Active state also paints a tall white pill at the rail's left edge.
 */
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
              'bg-surface-1 text-ink relative flex size-8 items-center justify-center overflow-hidden',
              'duration-base ease-wiscord transition-[border-radius,background-color]',
              isActive
                ? 'bg-blurple rounded-md'
                : 'group-hover:bg-blurple rounded-full group-hover:rounded-md',
              tileClassName,
            )}
          >
            {avatarSrc ? (
              <img
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
      ) : null}
    </div>
  );
}
