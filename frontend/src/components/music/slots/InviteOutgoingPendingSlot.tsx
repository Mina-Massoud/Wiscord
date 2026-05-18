import { Loader2 } from 'lucide-react';

import type { ListenTogetherInvite } from '@/types/listen-together';

interface InviteOutgoingPendingSlotProps {
  invite: ListenTogetherInvite;
}

/**
 * Sharer-side chip while waiting on the recipient. Same height as `bar`
 * so the morph from bar → pending → now-playing reads as one continuous
 * shape change. No interaction — the chip dissolves automatically when
 * the recipient accepts/declines or the 60s TTL elapses.
 */
export function InviteOutgoingPendingSlot({
  invite,
}: InviteOutgoingPendingSlotProps): React.JSX.Element {
  const targetName = invite.to.displayName ?? invite.to.username;
  return (
    <div className="flex h-full w-full items-center gap-2">
      <Loader2 className="text-blurple size-3 shrink-0 animate-spin" aria-hidden />
      <span className="text-caption min-w-0 flex-1 truncate font-medium">
        waiting on {targetName}…
      </span>
    </div>
  );
}
