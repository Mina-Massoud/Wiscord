import { useState } from 'react';
import { MessageCircle, MoreVertical } from 'lucide-react';

import { getIdenticonDataUrl } from '@/lib/avatar';
import { useCopy } from '@/lib/copy/useCopy';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { useRemoveFriend } from '@/queries/friends';
import type { FriendDto } from '@/queries/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MediaImg } from '@/components/ui/media-img';
import { PresenceDot } from '../atoms/PresenceDot';

interface FriendRowProps {
  friend: FriendDto;
}

/**
 * Single row in the Friends list (Online / All tabs).
 * Avatar + name + presence label, with trailing action icons on hover.
 *
 * Presence is hard-coded to 'offline' in this slice — a per-user presence
 * system isn't wired yet. The dot stays in the layout so adding presence
 * later is a one-prop change, not a layout swap.
 */
export function FriendRow({ friend }: FriendRowProps): React.JSX.Element {
  const t = useCopy();
  const { user } = friend;
  const avatarFallback = getIdenticonDataUrl(user.username);
  const displayName = user.displayName ?? user.username;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useRemoveFriend();

  function onRemoveConfirm(): void {
    remove.mutate(
      { userId: user.id },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          toast.success(t('friends.toast.removed'));
        },
        onError: (err) => {
          const message = err instanceof ApiError ? err.message : 'Something went wrong.';
          toast.error(message);
        },
      },
    );
  }

  return (
    <>
      <div className="group/friend hover:bg-glass-hover mx-2 flex h-[62px] cursor-pointer items-center gap-3 rounded-md px-3 transition-colors">
        <span className="relative shrink-0">
          <MediaImg
            src={user.avatarUrl ?? undefined}
            fallbackSrc={avatarFallback}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full"
            loading="lazy"
          />
          <span className="absolute -right-0.5 -bottom-0.5">
            <PresenceDot
              presence="offline"
              size={12}
              ringClassName="ring-glass-canvas group-hover/friend:ring-glass-hover"
            />
          </span>
        </span>

        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-ink text-subhead truncate font-semibold">{displayName}</span>
          <span className="text-ink-muted text-caption truncate">@{user.username}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover/friend:opacity-100">
          <button
            type="button"
            aria-label={`${t('friends.row.message')} ${displayName}`}
            onClick={(e) => e.preventDefault()}
            className="bg-glass-surface-2 border-glass-border text-ink-muted hover:text-ink flex size-9 items-center justify-center rounded-full border"
          >
            <MessageCircle className="size-5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${t('friends.row.more')} ${displayName}`}
                className="bg-glass-surface-2 border-glass-border text-ink-muted hover:text-ink flex size-9 items-center justify-center rounded-full border"
              >
                <MoreVertical className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setConfirmOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                {t('friends.row.remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('friends.remove.confirm.title')}</DialogTitle>
            <DialogDescription>{t('friends.remove.confirm.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onRemoveConfirm} disabled={remove.isPending}>
              {t('friends.row.remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
