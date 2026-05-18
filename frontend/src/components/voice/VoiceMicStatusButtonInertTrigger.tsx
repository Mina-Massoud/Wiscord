import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AudioWaveform } from 'lucide-react';

export function InertTrigger(): React.JSX.Element {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span
          className="text-ink-subtle flex size-8 items-center justify-center opacity-60"
          aria-hidden
        >
          <AudioWaveform className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        Join voice to test your mic
      </TooltipContent>
    </Tooltip>
  );
}
