import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Rocket } from 'lucide-react';

/**
 * Small blurple rocket overlay on a participant row whose `activityKind`
 * is non-null. The one blurple beat on this surface — it signals "this
 * person is in some activity" to other users so they know there's
 * something to join from the voice grid.
 */
export function ActivityHostIndicator() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="text-blurple inline-flex shrink-0 items-center"
          aria-label="Hosting an activity"
        >
          <Rocket className="size-3" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>Hosting an activity</TooltipContent>
    </Tooltip>
  );
}
