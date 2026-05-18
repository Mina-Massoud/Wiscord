import { Check, X } from 'lucide-react';

import { getIdenticonDataUrl } from '@/lib/avatar';
import { useCopy } from '@/lib/copy/useCopy';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import {
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useDeclineFriendRequest,
  useIncomingFriendRequests,
  useOutgoingFriendRequests,
} from '@/queries/friends';
import type { FriendRequestDto } from '@/queries/client';
import { Button } from '@/components/ui/button';
import { MediaImg } from '@/components/ui/media-img';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Pending tab — incoming requests (Accept / Decline) above, outgoing
 * requests (Cancel) below. Both sections render their own skeleton/empty
 * states; errors fall back to a single inline message per section.
 */
export function PendingTab(): React.JSX.Element {
  const t = useCopy();
  const incoming = useIncomingFriendRequests();
  const outgoing = useOutgoingFriendRequests();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 py-5">
      <PendingSection
        heading={`Incoming · ${incoming.data?.length ?? 0}`}
        isLoading={incoming.isLoading}
        isError={Boolean(incoming.error)}
        rows={incoming.data ?? []}
        emptyTitle={t('friends.empty.incoming.title')}
        renderRow={(req) => <IncomingRow key={req.id} request={req} />}
      />
      <PendingSection
        heading={`Outgoing · ${outgoing.data?.length ?? 0}`}
        isLoading={outgoing.isLoading}
        isError={Boolean(outgoing.error)}
        rows={outgoing.data ?? []}
        emptyTitle={t('friends.empty.outgoing.title')}
        renderRow={(req) => <OutgoingRow key={req.id} request={req} />}
      />
    </div>
  );
}

interface PendingSectionProps {
  heading: string;
  isLoading: boolean;
  isError: boolean;
  rows: FriendRequestDto[];
  emptyTitle: string;
  renderRow: (req: FriendRequestDto) => React.ReactNode;
}

function PendingSection({
  heading,
  isLoading,
  isError,
  rows,
  emptyTitle,
  renderRow,
}: PendingSectionProps): React.JSX.Element {
  return (
    <section>
      <h2 className="text-ink-muted text-caption mb-2 font-semibold tracking-wider uppercase">
        {heading}
      </h2>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <p className="text-destructive text-control">Couldn&apos;t load — try again in a sec.</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-muted text-control">{emptyTitle}</p>
      ) : (
        <div className="flex flex-col">{rows.map(renderRow)}</div>
      )}
    </section>
  );
}

function RowSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-[62px] items-center gap-3 px-1">
      <Skeleton className="size-8 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

interface RequestRowProps {
  request: FriendRequestDto;
}

function IncomingRow({ request }: RequestRowProps): React.JSX.Element {
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

function OutgoingRow({ request }: RequestRowProps): React.JSX.Element {
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
