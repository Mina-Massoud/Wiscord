import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface IdleSlotProps {
  /** Whether the user has connected YouTube Music (a Google integration). */
  connected: boolean;
}

/**
 * Brand-logo-only state. Renders before any track is loaded.
 *
 * When YouTube Music isn't connected yet the capsule is a passive,
 * non-clickable placeholder — so the logo desaturates to greyscale and a
 * hover tooltip explains why it's inert and points the user to Settings →
 * Integrations to connect it. Once connected the logo shows in full colour
 * and the capsule becomes the clickable search affordance.
 */
export function IdleSlot({ connected }: IdleSlotProps): React.JSX.Element {
  const logo = (
    <img
      src="/logo/youtube-music.webp"
      alt=""
      width={18}
      height={18}
      className={cn('size-[18px] object-contain', !connected && 'grayscale')}
    />
  );

  if (connected) {
    return <div className="flex h-full w-full items-center justify-center">{logo}</div>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-full w-full cursor-help items-center justify-center">{logo}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        YouTube Music isn't connected. Open Settings → Integrations to connect it.
      </TooltipContent>
    </Tooltip>
  );
}
