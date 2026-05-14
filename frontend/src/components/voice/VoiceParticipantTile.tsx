import {
  useIsSpeaking,
  useParticipantInfo,
  useTrackMutedIndicator,
} from '@livekit/components-react';
import { Track, type Participant } from 'livekit-client';
import { MicOff } from 'lucide-react';

import { cn } from '@/lib/cn';
import { getIdenticonDataUrl } from '@/lib/avatar';

interface VoiceParticipantTileProps {
  participant: Participant;
}

/**
 * Single voice-call tile. Centered avatar with the participant's display
 * name chipped along the bottom and a mic-muted indicator in the corner.
 * Speaking state lights up a soft ring on the tile edge.
 */
export function VoiceParticipantTile({
  participant,
}: VoiceParticipantTileProps): React.JSX.Element {
  const { name, identity } = useParticipantInfo({ participant });
  const isSpeaking = useIsSpeaking(participant);
  const { isMuted } = useTrackMutedIndicator({
    source: Track.Source.Microphone,
    participant,
  });

  const displayName = (name ?? '').trim() || identity || 'Unknown';
  const seed = identity || displayName;
  const avatar = getIdenticonDataUrl(seed, 256);

  return (
    <div
      className={cn(
        'bg-surface-1 border-border duration-base relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border transition-shadow',
        isSpeaking ? 'ring-success/80 ring-2' : 'ring-2 ring-transparent',
      )}
    >
      <img
        src={avatar}
        alt=""
        width={96}
        height={96}
        className="size-24 rounded-full"
        aria-hidden
      />

      {isMuted ? (
        <span className="bg-surface-3/80 absolute top-3 right-3 flex size-7 items-center justify-center rounded-full">
          <MicOff className="text-destructive size-4" aria-label="Microphone muted" />
        </span>
      ) : null}

      <div
        className="pointer-events-none absolute right-3 bottom-3 left-3 flex"
        aria-hidden={false}
      >
        <span className="bg-surface-3/80 text-ink text-caption min-w-0 truncate rounded-md px-2 py-1 font-medium">
          {displayName}
          {participant.isLocal ? (
            <span className="text-ink-muted ml-1 font-normal">· you</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
