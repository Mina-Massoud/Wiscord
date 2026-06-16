import { useMemo } from 'react';
import { useConnectionState, useParticipants } from '@livekit/components-react';
import { ConnectionState, type Participant } from 'livekit-client';

import type { ChannelDto } from '@/queries/channels';
import { useMyProfile } from '@/queries/profile';
import { useVoiceChannelParticipants } from '@/queries/voice-presence';
import { useConnectedChannelId } from '@/lib/voice-session-store';
import { StaticSidebarRow } from '@/components/voice/LabsChannelSidebarStaticSidebarRow';
import { LiveSidebarRow } from '@/components/voice/LabsChannelSidebarLiveSidebarRow';
import { ServerChannelRow } from './ServerChannelRow';

interface ServerVoiceChannelRowProps {
  channel: ChannelDto;
  serverId: string;
  isOwner: boolean;
}

/**
 * A voice channel row in the server sidebar with its live participant roster
 * indented underneath — the Discord shape the labs voice sidebar already uses.
 *
 * Source of truth is the server-side presence store (`useVoiceChannelParticipants`),
 * so every member sees who's in the channel without needing their own LiveKit
 * session. When the local user is connected *to this channel* we overlay the
 * LiveKit `Participant` so the row shows speaking ring + mic state in real time;
 * other channels (and the disconnected case) fall back to a static row.
 */
export function ServerVoiceChannelRow({
  channel,
  serverId,
  isOwner,
}: ServerVoiceChannelRowProps): React.JSX.Element {
  const presence = useVoiceChannelParticipants(channel.id);
  const connectedChannelId = useConnectedChannelId();
  const isConnectedHere = connectedChannelId === channel.id;
  const state = useConnectionState();
  const liveParticipants = useParticipants();
  const me = useMyProfile().data;

  // Only overlay LiveKit participants when we're actually connected to *this*
  // channel — otherwise `useParticipants()` reports a different room's roster.
  const liveByIdentity = useMemo(() => {
    if (!isConnectedHere || state !== ConnectionState.Connected) {
      return new Map<string, Participant>();
    }
    const out = new Map<string, Participant>();
    for (const p of liveParticipants) {
      const key = p.identity || p.sid;
      if (key) out.set(key, p);
    }
    return out;
  }, [isConnectedHere, state, liveParticipants]);

  const rows = presence.data ?? [];

  return (
    <div>
      <ServerChannelRow channel={channel} serverId={serverId} isOwner={isOwner} />
      {rows.length > 0 ? (
        <ul className="mt-0.5 flex flex-col gap-0.5 pl-6">
          {rows.map((row) => {
            const live = liveByIdentity.get(row.identity);
            const isInActivity = row.activityKind !== null;
            const isMe = row.identity === me?.id;
            return live ? (
              <LiveSidebarRow
                key={row.identity}
                row={row}
                participant={live}
                isActivityHost={isInActivity}
              />
            ) : (
              <StaticSidebarRow
                key={row.identity}
                row={row}
                isMe={isMe}
                isActivityHost={isInActivity}
              />
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
