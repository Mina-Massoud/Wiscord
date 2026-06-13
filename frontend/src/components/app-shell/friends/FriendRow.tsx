import { useState } from 'react';
import { MessageCircle, MoreVertical } from 'lucide-react';

import { getIdenticonDataUrl } from '@/lib/avatar';
import { useCopy } from '@/lib/copy/useCopy';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { useRemoveFriend } from '@/queries/friends';
import { useCreateDmRoom } from '@/queries/dms';
import type { FriendDto, PresenceStatus } from '@/queries/client';
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
  /** Live presence for this friend; defaults to offline if unknown. */
  status?: PresenceStatus;
}

/**
 * Single row in the Friends list (Online / All tabs).
 * Avatar + name + presence label, with trailing action icons on hover.
 * The presence dot reflects live status from the presence store.
 */
export function FriendRow({ friend, status = 'offline' }: FriendRowProps): React.JSX.Element {
  const t = useCopy();
  const { user } = friend;
  const avatarFallback = getIdenticonDataUrl(user.username);
  const displayName = user.displayName ?? user.username;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useRemoveFriend();
  const createDm = useCreateDmRoom();

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

  function handleStartDm(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    createDm.mutate(
      { recipientId: user.id },
      {
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
              presence={status}
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
            onClick={handleStartDm}
            disabled={createDm.isPending}
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
