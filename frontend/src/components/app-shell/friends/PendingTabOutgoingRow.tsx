import { useCopy } from '@/lib/copy/useCopy';
import { useCancelFriendRequest } from '@/queries/friends';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { MediaImg } from '@/components/ui/media-img';
import { Button } from '@/components/ui/button';
import type { RequestRowProps } from './PendingTab';

export function OutgoingRow({ request }: RequestRowProps): React.JSX.Element {
  const t = useCopy();
  const cancel = useCancelFriendRequest();

  const displayName = request.user.displayName ?? request.user.username;
  const avatarFallback = getIdenticonDataUrl(request.user.username);

  function onCancel(): void {
    cancel.mutate(
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
        <span className="text-ink-muted text-caption truncate">Sent · waiting</span>
      </div>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={cancel.isPending}>
        {t('friends.row.cancel')}
      </Button>
    </div>
  );
}
