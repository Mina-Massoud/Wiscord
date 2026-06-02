import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ServerChannelSidebarAddButtonProps {
  label: string;
  onClick: () => void;
}

export function ServerChannelSidebarAddButton({
  label,
  onClick,
}: ServerChannelSidebarAddButtonProps): React.JSX.Element {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-ink-muted hover:text-ink size-6 shrink-0"
          aria-label={label}
          onClick={onClick}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
