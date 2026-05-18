import { NotesEditor } from '@/components/notes/NotesEditor';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { ActivityHistoryFloatButton } from '@/components/activity/ActivityHistoryFloatButton';
import { findActivity } from '@/components/activity/ActivityRegistry';

interface NotesActivityEmbedProps {
  channelId: string;
  hostDisplayName: string;
  isHost: boolean;
  user: { id: string; displayName: string };
  onEndActivity: () => void;
}

/**
 * Notes activity embed. The shared notes doc is the existing `ChannelNotes`
 * row keyed by `channelId` — same backend as `/app/labs/notes/:id`, just
 * mounted inside the voice main pane. Realtime sync is handled by the
 * Hocuspocus provider inside `NotesEditor`.
 */
export function NotesActivityEmbed({
  channelId,
  hostDisplayName,
  isHost,
  user,
  onEndActivity,
}: NotesActivityEmbedProps): React.JSX.Element {
  const definition = findActivity('notes');
  if (!definition) throw new Error('Notes activity not in registry');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActivityHeader
        icon={definition.icon}
        title={definition.title}
        hostDisplayName={hostDisplayName}
        isHost={isHost}
        isHostLed={false}
        onLeaveActivity={onEndActivity}
      />
      <div className="relative flex min-h-0 flex-1 p-4">
        <NotesEditor channelId={channelId} user={user} />
        <ActivityHistoryFloatButton kind="notes" channelId={channelId} />
      </div>
    </div>
  );
}
