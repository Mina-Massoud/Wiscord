import { useCopy } from '@/lib/copy/useCopy';
import { useAcceptFriendRequest, useDeclineFriendRequest } from '@/queries/friends';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { MediaImg } from '@/components/ui/media-img';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import type { RequestRowProps } from './PendingTab';

export function IncomingRow({ request }: RequestRowProps): React.JSX.Element {
  const t = useCopy();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const busy = accept.isPending || decline.isPending;

  const displayName = request.user.displayName ?? request.user.username;
  const avatarFallback = getIdenticonDataUrl(request.user.username);

  function onAccept(): void {
    accept.mutate(
      { requestId: request.id },
      {
        onSuccess: () => toast.success(t('friends.toast.accepted')),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  }

  function onDecline(): void {
    decline.mutate(
      { requestId: request.id },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  }

  return (
    <div className="hover:bg-glass-hover flex h-[62px] items-center gap-3 rounded-md px-3 transition-colors">
      <MediaImg
        src={request.user.avatarUrl ?? undefined}
        fallbackSrc={avatarFallback}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full"
        loading="lazy"
      />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-ink text-subhead truncate font-semibold">{displayName}</span>
        <span className="text-ink-muted text-caption truncate">Wants to be friends</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          aria-label={`${t('friends.row.accept')} ${displayName}`}
          onClick={onAccept}
          disabled={busy}
        >
          <Check className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${t('friends.row.decline')} ${displayName}`}
          onClick={onDecline}
          disabled={busy}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
