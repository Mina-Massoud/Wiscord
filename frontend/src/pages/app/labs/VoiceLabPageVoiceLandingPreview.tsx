import { getIdenticonDataUrl } from '@/lib/avatar';
import { type VoiceChannelParticipant } from '@/queries/voice-presence';

interface VoiceLandingPreviewProps {
  participants: VoiceChannelParticipant[];
}

/**
 * Thumbnail card above the idle / left empty state.
 */
export function VoiceLandingPreview({ participants }: VoiceLandingPreviewProps): React.JSX.Element {
  const visible = participants.slice(0, 3);
  const overflow = Math.max(participants.length - visible.length, 0);

  return (
    <div className="border-glass-border bg-glass-surface-1 shadow-elevated relative flex aspect-video w-72 items-center justify-center overflow-hidden rounded-lg border">
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2">
          <img
            src="/logo/sleepy.webp"
            alt=""
            width={64}
            height={61}
            loading="lazy"
            className="size-16 object-contain opacity-80"
            aria-hidden
          />
          <span className="text-ink-subtle text-caption">Crickets in here rn</span>
        </div>
      ) : (
        <div className="flex items-center justify-center -space-x-4">
          {visible.map((p) => (
            <img
              key={p.identity}
              src={getIdenticonDataUrl(p.identity || p.name, 128)}
              alt=""
              width={64}
              height={64}
              className="border-glass-border-strong bg-surface-2 size-16 rounded-full border-2"
              aria-hidden
            />
          ))}
          {overflow > 0 ? (
            <span className="bg-surface-2 text-ink text-control border-glass-border-strong flex size-16 items-center justify-center rounded-full border-2 font-semibold">
              +{overflow}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
