import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface ServerRailRailActionIconProps {
  label: string;
  icon: React.ReactNode;
  accent: 'online' | 'blurple';
  onClick?: () => void;
}

const tileClassName = cn(
  'bg-glass-surface-1 duration-base ease-wiscord size-8 shrink-0 p-0 transition-[border-radius,background-color,color]',
  'rounded-full hover:rounded-md',
);

export function ServerRailRailActionIcon({
  label,
  icon,
  accent,
  onClick,
}: ServerRailRailActionIconProps): React.JSX.Element {
  const accentClassName =
    accent === 'online'
      ? 'text-presence-online hover:bg-presence-online hover:text-white'
      : 'text-blurple hover:bg-blurple hover:text-white';

  return (
    <div className="group relative flex h-10 w-full items-center justify-center">
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          {onClick ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onClick}
              aria-label={label}
              className={cn(tileClassName, accentClassName)}
            >
              {icon}
            </Button>
          ) : (
            <Link
              to="#"
              onClick={(e) => e.preventDefault()}
              aria-label={label}
              className={cn(
                tileClassName,
                'flex items-center justify-center',
                accent === 'online'
                  ? 'text-presence-online group-hover:bg-presence-online group-hover:text-white'
                  : 'text-blurple group-hover:bg-blurple group-hover:text-white',
              )}
            >
              {icon}
            </Link>
          )}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
