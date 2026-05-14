import { useParticipants } from '@livekit/components-react';

import { cn } from '@/lib/cn';
import { VoiceParticipantTile } from './VoiceParticipantTile';

/**
 * Auto-fitting grid of voice participants. Mirrors Discord's voice-channel
 * grid: one tile per participant, dense at small counts, three-column past 4.
 *
 * The grid is the only scrollable region inside the main pane so the floating
 * control bar always stays pinned at the bottom.
 */
export function VoiceGrid(): React.JSX.Element {
  const participants = useParticipants();
  const count = participants.length;

  if (count === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-ink-muted text-control">Connecting to the lounge…</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid flex-1 gap-3 overflow-auto p-6',
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
  );
}
