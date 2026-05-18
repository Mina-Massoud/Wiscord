import { useState } from 'react';
import { LogOut } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/lib/toast';
import { useEndListenTogetherSession } from '@/queries/listen-together';
import type { ListenTogetherSession } from '@/types/listen-together';

interface HostSessionIndicatorProps {
  session: ListenTogetherSession;
}

/**
 * Compact "vibing with @alice — leave" pill rendered in the host's
 * expanded-now-playing header in place of the share popover. Replaces
 * the share affordance during an active session so the host has a
 * one-click exit and isn't tempted to invite a second friend (one
 * session per user, server-enforced).
 */
export function HostSessionIndicator({ session }: HostSessionIndicatorProps): React.JSX.Element {
  const endSession = useEndListenTogetherSession();
  const [leaving, setLeaving] = useState(false);
  const partner = session.viewer;
  const partnerName = partner.displayName ?? partner.username;

  async function handleLeave(): Promise<void> {
    if (leaving) return;
    setLeaving(true);
    try {
      await endSession.mutateAsync({ sessionId: session.id });
    } catch {
      setLeaving(false);
      toast.error("couldn't bounce. try again.");
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void handleLeave()}
          disabled={leaving}
          aria-label={`Leave session with ${partnerName}`}
          className="bg-success/15 text-success hover:bg-success/25 text-badge inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium disabled:opacity-50"
        >
          <span className="bg-success size-1.5 rounded-full" aria-hidden />
          <span className="max-w-[6rem] truncate">{partnerName}</span>
          <LogOut className="size-3" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>Bounce from this sesh</TooltipContent>
    </Tooltip>
  );
}
