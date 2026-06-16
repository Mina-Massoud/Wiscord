import { useState } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';

import { Sidebar } from '@/components/ui/sidebar-shell';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import type { ChannelDto, ChannelType } from '@/queries/channels';
import type { ServerDto } from '@/queries/servers';
import { useDeleteServer, useLeaveServer } from '@/queries/servers';
import { useSession } from '@/queries/auth';
import { useServerEvents } from '@/queries/events';
import { cn } from '@/lib/cn';
import { CreateChannelDialog } from './CreateChannelDialog';
import { ServerChannelRow } from './ServerChannelRow';
import { ServerVoiceChannelRow } from './ServerVoiceChannelRow';
import { ServerChannelSidebarAddButton } from './ServerChannelSidebarAddButton';
import { ServerInviteDialog } from './ServerInviteDialog';
import { ServerSettingsDropdown } from './ServerSettingsDropdown';
import { EditServerDialog } from './EditServerDialog';

interface ServerChannelSidebarProps {
  server: ServerDto | undefined;
  channels: ChannelDto[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function ServerChannelSidebar({
  server,
  channels,
  isLoading,
  isError,
}: ServerChannelSidebarProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionQuery = useSession();
  const currentUserId = sessionQuery.data?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<ChannelType>('text');
  const [confirmAction, setConfirmAction] = useState<'delete' | 'leave' | null>(null);

  const deleteServer = useDeleteServer();
  const leaveServer = useLeaveServer();

  const eventsQuery = useServerEvents(server?.id);

  if (!server) return null;

  const isEventsActive = location.pathname.endsWith('/events');
  const upcomingEventsCount = (eventsQuery.data ?? []).filter(
    (e) => e.status === 'scheduled' && new Date(e.startsAt) >= new Date(),
  ).length;

  const textChannels = (channels ?? []).filter((c) => c.type === 'text');
  const voiceChannels = (channels ?? []).filter((c) => c.type === 'voice');

  const isOwner = currentUserId === server.ownerId;
  const isConfirmPending = deleteServer.isPending || leaveServer.isPending;

  function openCreate(type: ChannelType): void {
    setDefaultType(type);
    setCreateOpen(true);
  }

  function handleConfirm(): void {
    if (confirmAction === 'delete') {
      deleteServer.mutate(server!.id, {
        onSuccess: () => {
          toast.success(`Deleted ${server!.name}`);
          setConfirmAction(null);
          void navigate('/app', { replace: true });
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Couldn't delete server.");
        },
      });
    } else if (confirmAction === 'leave') {
      leaveServer.mutate(server!.id, {
        onSuccess: () => {
          toast.success(`Left ${server!.name}`);
          setConfirmAction(null);
          void navigate('/app', { replace: true });
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Couldn't leave server.");
        },
      });
    }
  }

  return (
    <>
      <Sidebar.Root>
        <div className="border-b border-glass-border">
          <ServerSettingsDropdown
            server={server}
            currentUserId={currentUserId}
            onInvite={() => setInviteOpen(true)}
            onEditSettings={() => setSettingsOpen(true)}
            onLeave={() => setConfirmAction('leave')}
            onDelete={() => setConfirmAction('delete')}
          />
        </div>

        <Sidebar.Body>
          <div className="px-1.5">
            <Link
              to={`/app/servers/${server.id}/events`}
              aria-current={isEventsActive ? 'page' : undefined}
              className={cn(
                'hover:bg-surface-hover flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors',
                isEventsActive && 'bg-surface-active text-ink',
              )}
            >
              <Calendar className="text-ink-muted size-4 shrink-0" aria-hidden />
              <span className="text-ink text-tab min-w-0 truncate font-semibold">Events</span>
              {upcomingEventsCount > 0 && (
                <span className="ml-auto bg-blurple text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                  {upcomingEventsCount}
                </span>
              )}
            </Link>
          </div>

          <Sidebar.Section
            title="Text channels"
            trailing={
              <ServerChannelSidebarAddButton
                label="Create text channel"
                onClick={() => openCreate('text')}
              />
            }
          >
            {isLoading ? <Sidebar.ListSkeleton rows={1} dotClassName="size-4 rounded" /> : null}
            {isError ? <Sidebar.Error>Couldn&apos;t load channels.</Sidebar.Error> : null}
            {!isLoading && !isError && textChannels.length === 0 ? (
              <Sidebar.Empty>No text channels yet.</Sidebar.Empty>
            ) : null}
            {textChannels.map((channel) => (
              <ServerChannelRow
                key={channel.id}
                channel={channel}
                serverId={server.id}
                isOwner={isOwner}
              />
            ))}
          </Sidebar.Section>

          <Sidebar.Section
            title="Voice channels"
            trailing={
              <ServerChannelSidebarAddButton
                label="Create voice channel"
                onClick={() => openCreate('voice')}
              />
            }
          >
            {isLoading ? <Sidebar.ListSkeleton rows={1} dotClassName="size-4 rounded" /> : null}
            {!isLoading && !isError && voiceChannels.length === 0 ? (
              <Sidebar.Empty>No voice channels yet.</Sidebar.Empty>
            ) : null}
            {voiceChannels.map((channel) => (
              <ServerVoiceChannelRow
                key={channel.id}
                channel={channel}
                serverId={server.id}
                isOwner={isOwner}
              />
            ))}
          </Sidebar.Section>
        </Sidebar.Body>
      </Sidebar.Root>

      <CreateChannelDialog
        serverId={server.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultType={defaultType}
      />

      <ServerInviteDialog
        serverId={server.id}
        serverName={server.name}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />

      <EditServerDialog
        server={server}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open: boolean) => { if (!open) setConfirmAction(null); }}
      >
        <AlertDialogContent className="border-glass-border bg-canvas max-w-md">
          <AlertDialogTitle className="text-body font-bold text-ink">
            {confirmAction === 'delete' ? `Delete "${server.name}"?` : `Leave "${server.name}"?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-ink-muted text-control mt-2">
            {confirmAction === 'delete'
              ? 'This permanently deletes the server, all its channels, and removes every member. This cannot be undone.'
              : 'You will lose access to all channels and messages. You can rejoin with an invite link.'}
          </AlertDialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmAction(null)}
              disabled={isConfirmPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isConfirmPending}
            >
              {isConfirmPending ? (
                <>
                  <RefreshCw className="size-4 animate-spin" aria-hidden />
                  {confirmAction === 'delete' ? 'Deleting…' : 'Leaving…'}
                </>
              ) : confirmAction === 'delete' ? (
                'Delete server'
              ) : (
                'Leave server'
              )}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}