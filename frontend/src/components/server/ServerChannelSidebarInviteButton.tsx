import { UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ServerChannelSidebarInviteButtonProps {
  onClick: () => void;
}

export function ServerChannelSidebarInviteButton({
  onClick,
}: ServerChannelSidebarInviteButtonProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClick}
          aria-label="Invite people"
        >
          <UserPlus className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Invite people</TooltipContent>
    </Tooltip>
  );
}
