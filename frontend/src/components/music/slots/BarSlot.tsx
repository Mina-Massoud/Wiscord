import { useMusicPlayerStore } from '@/lib/music-player-store';
import type { MusicTrack } from '@/types/music';

import { MusicWaveform } from '../MusicWaveform';

interface BarSlotProps {
  track: MusicTrack;
}

/** Collapsed pill — brand mark + truncated title + waveform. */
export function BarSlot({ track }: BarSlotProps): React.JSX.Element {
  const isPlaying = useMusicPlayerStore((s) => s.isPlaying);
  return (
    <div className="flex h-full w-full items-center gap-2">
      <img
        src="/logo/youtube-music.webp"
        alt=""
        width={14}
        height={14}
        className="size-[14px] shrink-0 object-contain"
      />
      <span className="text-caption min-w-0 flex-1 truncate font-medium">{track.title}</span>
      <MusicWaveform
        active={isPlaying}
        bars={14}
        className="text-ink/80 h-[14px] w-[44px] shrink-0"
      />
    </div>
  );
}
