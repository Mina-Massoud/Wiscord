import { useParticipants } from '@livekit/components-react';

import { cn } from '@/lib/cn';
import { VoiceParticipantTile } from './VoiceParticipantTile';

interface VoiceGridProps {
  /**
   * Optional overlay slot rendered at the top of the grid above the tiles.
   * Used by `VoiceLabPage` to surface "in progress" activity cards so
   * participants can join — or not — other people's activities without
   * being force-redirected.
   */
  children?: React.ReactNode;
}

/**
 * Auto-fitting grid of voice participants. Mirrors Discord's voice-channel
 * grid: one tile per participant, dense at small counts, three-column past 4.
 *
 * The grid is the only scrollable region inside the main pane so the floating
 * control bar always stays pinned at the bottom.
 */
export function VoiceGrid({ children }: VoiceGridProps = {}): React.JSX.Element {
  const participants = useParticipants();
  const count = participants.length;

  if (count === 0) {
    return (
      <div className="flex flex-1 flex-col gap-3 overflow-auto p-6">
        {children}
        <div className="flex flex-1 items-center justify-center">
          <p className="text-ink-muted text-control">Connecting to the lounge…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
      {children}
      <div
        className={cn(
          'grid flex-1 gap-3',
          count === 1 && 'grid-cols-1',
          count === 2 && 'grid-cols-1 sm:grid-cols-2',
          (count === 3 || count === 4) && 'grid-cols-2',
          count >= 5 && 'grid-cols-2 lg:grid-cols-3',
        )}
      >
        {participants.map((p) => (
          <VoiceParticipantTile key={p.identity || p.sid} participant={p} />
        ))}
      </div>
    </div>
  );
}
