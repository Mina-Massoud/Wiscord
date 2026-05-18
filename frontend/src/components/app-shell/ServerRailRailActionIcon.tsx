import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

interface RailActionIconProps {
  label: string;
  icon: React.ReactNode;
  /** Color the icon turns on hover. */
  accent: 'online' | 'blurple';
}

export function RailActionIcon({ label, icon, accent }: RailActionIconProps): React.JSX.Element {
  return (
    <div className="group relative flex h-10 w-full items-center justify-center">
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Link
            to="#"
            onClick={(e) => e.preventDefault()}
            aria-label={label}
            className={cn(
              'bg-glass-surface-1 duration-base ease-wiscord flex size-8 items-center justify-center transition-[border-radius,background-color,color]',
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
