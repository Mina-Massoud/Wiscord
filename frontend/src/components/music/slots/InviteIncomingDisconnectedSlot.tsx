import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { useStartIntegrationConnect } from '@/queries/integrations';
import { useDeclineListenTogetherInvite } from '@/queries/listen-together';
import type { ListenTogetherInvite } from '@/types/listen-together';

interface InviteIncomingDisconnectedSlotProps {
  invite: ListenTogetherInvite;
}

/**
 * Recipient state when the recipient has no YouTube Music integration.
 * Single-row horizontal pill — same proportions as the connected
 * variant so both invite states feel like the same kind of "incoming"
 * notification, no modal popup. Reuses `useStartIntegrationConnect`
 * directly so the OAuth flow runs from inside the capsule.
 *
 * Project principle: "ship the UI to the user, not the user to the UI."
 */
export function InviteIncomingDisconnectedSlot({
  invite,
}: InviteIncomingDisconnectedSlotProps): React.JSX.Element {
  const startConnect = useStartIntegrationConnect();
  const declineInvite = useDeclineListenTogetherInvite();
  const [busy, setBusy] = useState<'connect' | 'decline' | null>(null);

  async function handleConnect(): Promise<void> {
    if (busy) return;
    setBusy('connect');
    try {
      const { url } = await startConnect.mutateAsync('google');
      window.location.assign(url);
      // No setBusy(null) — page is about to unmount.
    } catch (err) {
      setBusy(null);
      toast.error(
        err instanceof ApiError && err.message ? err.message : "couldn't start connect. try again.",
      );
    }
  }

  async function handleDecline(): Promise<void> {
    if (busy) return;
    setBusy('decline');
    try {
      await declineInvite.mutateAsync({ inviteId: invite.id });
    } catch {
      setBusy(null);
      toast.error("couldn't decline. try again.");
    }
  }

  const fromName = invite.from.displayName ?? invite.from.username;

  return (
    <div className="flex h-full w-full items-center gap-3">
      <img
        src="/logo/youtube-music.webp"
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0 object-contain"
      />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-ink text-control truncate font-medium">
          {fromName}'s tryna vibe 🎧
        </span>
        <span className="text-ink-muted text-caption truncate">Plug in YouTube Music to join.</span>
      </div>
      <button
        type="button"
        onClick={() => void handleDecline()}
        aria-label="Not now"
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
        onClick={() => void handleConnect()}
        aria-label="Connect YouTube Music"
        disabled={busy !== null}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          'bg-blurple text-ink hover:bg-blurple/90',
          'disabled:opacity-50',
        )}
      >
        {busy === 'connect' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" strokeWidth={3} />
        )}
      </button>
    </div>
  );
}
