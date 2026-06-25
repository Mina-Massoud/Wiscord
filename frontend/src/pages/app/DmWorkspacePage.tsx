import { useParams } from 'react-router';
import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { ServerRail } from '@/components/server/ServerRail';
import { DmSidebar } from '@/components/app-shell/friends/DmSidebar';
import { DmChatView } from '@/components/dms/DmChatView';
import { DmHeaderPresence } from '@/components/dms/DmHeaderPresence';
import { useDmRoom } from '@/queries/dms';
import { getIdenticonDataUrl } from '@/lib/avatar';

export default function DmWorkspacePage(): React.JSX.Element {
  const { dmRoomId = '' } = useParams<{ dmRoomId: string }>();
  const { data: room, isLoading, isError } = useDmRoom(dmRoomId);

  const recipient = room?.recipient;
  const avatarSrc =
    recipient?.avatarUrl || (recipient?.id ? getIdenticonDataUrl(recipient.id) : '');

  const titleBarText = recipient
    ? `${recipient.displayName || recipient.username}`
    : 'Direct Message';

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title={titleBarText} />}
      serverRail={<ServerRail />}
      sidebar={<DmSidebar />}
      userPanel={<GlobalUserPanel />}
      topBar={
        <div className="border-glass-border bg-glass-surface-chrome flex h-12 w-full items-center gap-3 border-b px-4 backdrop-blur-md">
          {recipient && (
            <>
              <img
                src={avatarSrc}
                alt=""
                className="size-7 rounded-full object-cover"
                loading="eager"
              />
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className="text-foreground text-subhead truncate font-semibold">
                  {recipient.displayName || recipient.username}
                </span>
                {recipient.displayName && (
                  <span className="text-ink-subtle text-caption truncate">
                    @{recipient.username}
                  </span>
                )}
              </div>
              <div className="ml-auto">
                <DmHeaderPresence userId={recipient.id} />
              </div>
            </>
          )}
        </div>
      }
      main={
        isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="border-blurple h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : isError || !room ? (
          <div className="text-ink-muted text-body flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p>Couldn&apos;t load this conversation.</p>
          </div>
        ) : (
          <DmChatView room={room} />
        )
      }
    />
  );
}
