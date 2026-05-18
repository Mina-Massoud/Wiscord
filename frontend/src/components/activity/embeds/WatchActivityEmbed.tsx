import type { WatchActivitySnapshot } from '@/queries/client';

import { WatchPlayer } from '@/components/watch/WatchPlayer';
import { WatchSourcePicker } from '@/components/watch/WatchSourcePicker';
import type { Viewer } from '@/components/watch/ViewerDots';

interface WatchActivityEmbedProps {
  /**
   * Watch-narrowed activity snapshot, or null when the host hasn't picked
   * a source yet. The dispatcher narrows for us.
   */
  party: WatchActivitySnapshot | null;
  isHost: boolean;
  hostDisplayName: string;
  viewers: Viewer[];
  /**
   * Which side of the picker to show when there's no party yet. Locking
   * the picker to YouTube or Screen Share matches the activity the user
   * clicked in the launcher — they shouldn't be re-asked to choose.
   */
  lockedKind: 'youtube' | 'screen-share';
  onPickSource: (input: {
    kind: 'youtube' | 'direct' | 'screen';
    url: string;
    title: string | null;
  }) => void;
  isStarting: boolean;
  onEndActivity: () => void;
}

/**
 * Watch-kind activity embed (youtube / screen-share). When the host has
 * already started the watch session we render the real player; otherwise
 * we show the source picker. The picker is host-only — non-host viewers
 * who somehow land here while there's no party doc see a "waiting on the
 * host" empty state (rare; the activity doc usually arrives first via
 * realtime).
 */
export function WatchActivityEmbed({
  party,
  isHost,
  hostDisplayName,
  viewers,
  lockedKind,
  onPickSource,
  isStarting,
  onEndActivity,
}: WatchActivityEmbedProps): React.JSX.Element {
  if (!party) {
    if (!isHost) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="text-ink text-body">Waiting on the host to pick something.</p>
          <p className="text-ink-muted text-caption">You&apos;ll join automatically.</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <WatchSourcePicker onStart={onPickSource} isStarting={isStarting} lockedKind={lockedKind} />
      </div>
    );
  }

  return (
    <WatchPlayer
      party={party}
      isHost={isHost}
      hostDisplayName={hostDisplayName}
      viewers={viewers}
      onEndParty={onEndActivity}
    />
  );
}
