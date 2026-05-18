import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

import { MediaImg } from '@/components/ui/media-img';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import {
  useAcceptListenTogetherInvite,
  useDeclineListenTogetherInvite,
} from '@/queries/listen-together';
import type { ListenTogetherInvite } from '@/types/listen-together';

interface InviteIncomingConnectedSlotProps {
  invite: ListenTogetherInvite;
}

/**
 * Horizontal "wants to vibe" pill shown to the recipient when they have
 * an integration connected. Avatar + copy + red X / green ✓ action
 * circles. Decline collapses; accept morphs into the mirrored player.
 *
 * Audio doesn't start on accept until the host emits a `play` event —
 * we never auto-blast audio at the recipient (project rule
 * `feedback_no_auto_mic.md` applies to listen-together too).
 */
export function InviteIncomingConnectedSlot({
  invite,
}: InviteIncomingConnectedSlotProps): React.JSX.Element {
  const acceptInvite = useAcceptListenTogetherInvite();
  const declineInvite = useDeclineListenTogetherInvite();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  async function handleAccept(): Promise<void> {
    if (busy) return;
    setBusy('accept');
    try {
      await acceptInvite.mutateAsync({ inviteId: invite.id });
      // Sync hook will start the audio once the host emits playback.
    } catch (err) {
      setBusy(null);
      toast.error(decodeError(err, "couldn't join. try again."));
    }
  }

  async function handleDecline(): Promise<void> {
    if (busy) return;
    setBusy('decline');
    try {
      await declineInvite.mutateAsync({ inviteId: invite.id });
    } catch (err) {
      setBusy(null);
      toast.error(decodeError(err, "couldn't decline. try again."));
    }
  }

  const fromName = invite.from.displayName ?? invite.from.username;

  return (
    <div className="flex h-full w-full items-center gap-3">
      <MediaImg
        src={invite.from.avatarUrl ?? undefined}
        fallbackSrc={getIdenticonDataUrl(invite.from.id)}
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-full object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-ink text-control truncate font-medium">
          {fromName} wants to vibe 🎧
        </span>
        <span className="text-ink-muted text-caption truncate">“{invite.track.title}”</span>
      </div>
      <button
        type="button"
        onClick={() => void handleDecline()}
        aria-label="Decline"
        disabled={busy !== null}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          'bg-destructive/15 text-destructive hover:bg-destructive/25',
          'disabled:opacity-50',
        )}
      >
        {busy === 'decline' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <X className="size-4" strokeWidth={3} />
        )}
      </button>
      <button
        type="button"
        onClick={() => void handleAccept()}
        aria-label="Accept"
        disabled={busy !== null}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          'bg-success/15 text-success hover:bg-success/25',
          'disabled:opacity-50',
        )}
      >
        {busy === 'accept' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" strokeWidth={3} />
        )}
      </button>
    </div>
  );
}

function decodeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'already_in_session') return "you're already in a session.";
    if (err.code === 'not_found') return 'invite already gone. probably timed out.';
  }
  return fallback;
}
