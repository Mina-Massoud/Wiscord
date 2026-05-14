import { Maximize2, Minimize2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

interface WhiteboardFullscreenToggleProps {
  isFullscreen: boolean;
  onToggle: () => void;
}

/**
 * Top-right floating button that hides the AppShellLayout chrome so
 * the canvas fills the viewport. Stays glass-themed (no white pill)
 * so it doesn't shout from the corner; clicking it (or hitting `Esc`
 * while in focus mode — wired up by the parent page) flips back to
 * the normal shell. The button is rendered inside the canvas area so
 * it's reachable in both modes.
 */
export function WhiteboardFullscreenToggle({
  isFullscreen,
  onToggle,
}: WhiteboardFullscreenToggleProps): React.JSX.Element {
  const Icon = isFullscreen ? Minimize2 : Maximize2;
  const label = isFullscreen ? 'Exit focus mode' : 'Focus mode';

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-pressed={isFullscreen}
            onClick={onToggle}
            className={cn(
              'pointer-events-auto absolute top-4 right-4 z-10 size-9 rounded-full',
              'bg-glass-surface-2 border-glass-border hover:bg-glass-active border',
              'backdrop-blur-glass-sm shadow-glass text-ink',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{label} (Esc)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
