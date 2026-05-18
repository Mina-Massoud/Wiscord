import { useState } from 'react';
import { LogOut, Volume2, VolumeX } from 'lucide-react';

import { MediaImg } from '@/components/ui/media-img';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { useMusicPlayerStore } from '@/lib/music-player-store';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { useEndListenTogetherSession } from '@/queries/listen-together';
import type { ListenTogetherSession } from '@/types/listen-together';

import { MusicWaveform } from '../MusicWaveform';
import { Scrubber } from './Scrubber';

interface ListenTogetherNowPlayingSlotProps {
  session: ListenTogetherSession;
}

/**
 * Mirrored playback view shown to the viewer in an active session.
 * Same visual language as the regular now-playing card, plus a 20px
 * partner-strip header ("vibing with @mina") and a Leave button.
 *
 * Transport is read-only: the viewer can't pause/seek host playback.
 * The host's `ExpandedNowPlayingSlot` already gives them full control.
 *
 * Audio state is read from the `music-player-store` — `useListenTogetherSync`
 * pipes host playback events into that store; this view just renders.
 */
export function ListenTogetherNowPlayingSlot({
  session,
}: ListenTogetherNowPlayingSlotProps): React.JSX.Element {
  const isPlaying = useMusicPlayerStore((s) => s.isPlaying);
  const progressMs = useMusicPlayerStore((s) => s.progressMs);
  const durationMs = useMusicPlayerStore((s) => s.durationMs);
  const localMuted = useMusicPlayerStore((s) => s.localMuted);
  const toggleLocalMute = useMusicPlayerStore((s) => s.toggleLocalMute);

  const endSession = useEndListenTogetherSession();
  const [leaving, setLeaving] = useState(false);

  const partner = session.host;
  const partnerName = partner.displayName ?? partner.username;

  async function handleLeave(): Promise<void> {
    if (leaving) return;
    setLeaving(true);
    try {
      await endSession.mutateAsync({ sessionId: session.id });
    } catch (err) {
      setLeaving(false);
      if (err instanceof ApiError) {
        toast.error("couldn't bounce. try again.");
      }
    }
  }

  return (
    <div className="flex h-full flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <header className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <MediaImg
            src={partner.avatarUrl ?? undefined}
            fallbackSrc={getIdenticonDataUrl(partner.id)}
            alt=""
            width={18}
            height={18}
            className="size-[18px] shrink-0 rounded-full object-cover"
          />
          <span className="text-ink-muted text-badge truncate font-bold tracking-wider uppercase">
            Vibing with {partnerName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleLeave()}
          aria-label="Leave session"
          disabled={leaving}
          className="text-ink-muted hover:text-ink disabled:opacity-50"
        >
          <LogOut className="size-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="flex items-start gap-3">
          <img
            src={session.track.thumbnailUrl}
            alt=""
            width={68}
            height={68}
            className="border-glass-border size-[68px] shrink-0 rounded-md border object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-ink text-control min-w-0 truncate leading-tight font-semibold">
                {session.track.title}
              </span>
              <MusicWaveform
                active={isPlaying}
                bars={5}
                className="text-success h-[16px] w-[14px] shrink-0"
              />
            </div>
            <span className="text-ink-muted text-caption truncate">{session.track.artist}</span>
          </div>
        </div>

        <Scrubber progressMs={progressMs} durationMs={durationMs} onSeek={() => {}} readOnly />

        <div className="flex items-center justify-center gap-3">
          {/* Local mute toggle. Host stays in control of transport — this
              just silences the iframe on the viewer's side. The iframe
              keeps decoding so we stay in sync; unmute resumes audio at
              the host's current position. */}
          <button
            type="button"
            onClick={toggleLocalMute}
            aria-label={localMuted ? `Unmute ${partnerName}` : `Mute ${partnerName}`}
            aria-pressed={localMuted}
            className={cn(
              'bg-ink/20 text-ink hover:bg-ink/30 flex size-9 items-center justify-center rounded-full transition-colors',
              localMuted && 'bg-destructive/25 text-destructive hover:bg-destructive/35',
            )}
          >
            {localMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <span className="text-ink-muted text-caption">
            {partnerName} is DJ{localMuted ? ' · muted' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
