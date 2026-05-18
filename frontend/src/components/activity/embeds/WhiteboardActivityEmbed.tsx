import { WhiteboardCanvas } from '@/components/whiteboard/WhiteboardCanvas';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { ActivityHistoryFloatButton } from '@/components/activity/ActivityHistoryFloatButton';
import { findActivity } from '@/components/activity/ActivityRegistry';
import type { WhiteboardIdentity } from '@/types/whiteboard';

interface WhiteboardActivityEmbedProps {
  channelId: string;
  hostDisplayName: string;
  isHost: boolean;
  identity: WhiteboardIdentity;
  onEndActivity: () => void;
}

/**
 * Whiteboard activity embed. The shared canvas is the existing
 * `ChannelWhiteboard` row keyed by `channelId` — same backend as
 * `/app/labs/whiteboard/:id`, just mounted inside the voice main pane.
 * Realtime sync is handled by the tldraw sync gateway inside
 * `WhiteboardCanvas`.
 */
export function WhiteboardActivityEmbed({
  channelId,
  hostDisplayName,
  isHost,
  identity,
  onEndActivity,
}: WhiteboardActivityEmbedProps): React.JSX.Element {
  const definition = findActivity('whiteboard');
  if (!definition) throw new Error('Whiteboard activity not in registry');

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
      <div className="relative flex min-h-0 flex-1">
        <WhiteboardCanvas channelId={channelId} identity={identity} />
        <ActivityHistoryFloatButton kind="whiteboard" channelId={channelId} />
      </div>
    </div>
  );
}
