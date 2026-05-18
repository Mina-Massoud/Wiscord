import { useCopy } from '@/lib/copy/useCopy';
import { useIncomingFriendRequests, useOutgoingFriendRequests } from '@/queries/friends';
import type { FriendRequestDto } from '@/queries/client';
import { PendingSection } from './PendingTabPendingSection';
import { IncomingRow } from './PendingTabIncomingRow';
import { OutgoingRow } from './PendingTabOutgoingRow';

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

export interface RequestRowProps {
  request: FriendRequestDto;
}
