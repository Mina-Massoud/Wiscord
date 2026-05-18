import { useFriends } from '@/queries/friends';
import { useSendListenTogetherInvite } from '@/queries/listen-together';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MediaImg } from '@/components/ui/media-img';
import { getIdenticonDataUrl } from '@/lib/avatar';
import type { MusicTrack } from '@/types/music';

interface FriendPickerProps {
  track: MusicTrack;
  onClose: () => void;
}

const SEND_ERROR_COPY: Record<string, string> = {
  recipient_offline: "they're not around. try again later.",
  already_in_session: "one of y'all is already in a session.",
  cannot_invite_self: "you can't vibe with yourself, fam.",
  forbidden: 'add them as a friend first.',
};

export function FriendPicker({ track, onClose }: FriendPickerProps): React.JSX.Element {
  const { data: friends, isLoading } = useFriends();
  const sendInvite = useSendListenTogetherInvite();
  const [busyFor, setBusyFor] = useState<string | null>(null);

  async function handleSend(toUserId: string, displayName: string): Promise<void> {
    setBusyFor(toUserId);
    try {
      await sendInvite.mutateAsync({ toUserId, track });
      toast.success(`pinged ${displayName} 🎧`, { description: 'waiting on them to vibe' });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const copy = SEND_ERROR_COPY[err.code] ?? "couldn't ping them. try again.";
        toast.error(copy);
      } else {
        toast.error("couldn't ping them. try again.");
      }
    } finally {
      setBusyFor(null);
    }
  }

  return (
    <div className="flex flex-col">
      <header className="border-glass-border border-b px-3 py-2.5">
        <p className="text-ink text-control font-semibold">Need a break? 🎧</p>
        <p className="text-ink-muted text-caption">Pick someone to vibe with.</p>
      </header>

      <div className="max-h-72 min-h-[120px] overflow-y-auto p-1">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="text-ink-muted size-4 animate-spin" aria-label="Loading" />
          </div>
        ) : !friends || friends.length === 0 ? (
          <p className="text-ink-muted text-caption px-3 py-6 text-center">
            No friends yet. Make some, fam.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {friends.map((f) => {
              const displayName = f.user.displayName ?? f.user.username;
              const busy = busyFor === f.user.id;
              return (
                <li key={f.user.id}>
                  <button
                    type="button"
                    onClick={() => void handleSend(f.user.id, displayName)}
                    disabled={busy || busyFor !== null}
                    className={cn(
                      'hover:bg-glass-hover flex w-full items-center gap-3 rounded-md px-2 py-2 text-left',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    <MediaImg
                      src={f.user.avatarUrl ?? undefined}
                      fallbackSrc={getIdenticonDataUrl(f.user.id)}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded-full object-cover"
                    />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-ink text-control truncate font-medium">
                        {displayName}
                      </span>
                      <span className="text-ink-muted text-caption truncate">
                        @{f.user.username}
                      </span>
                    </span>
                    {busy ? (
                      <Loader2
                        className="text-ink-muted size-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <span className="text-blurple text-caption shrink-0 font-medium">Send</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
