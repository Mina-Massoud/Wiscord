import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Link2, MonitorUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { detectWatchSource } from '@/lib/watch-source';
import { toast } from '@/lib/toast';

import type { WatchSourceKind } from '@/queries/client';
import { YouTubeBrandMark } from './YouTubeBrandMark';

interface WatchSourcePickerProps {
  onStart: (input: { kind: WatchSourceKind; url: string; title: string | null }) => void;
  isStarting: boolean;
  /**
   * Lock the picker to a single source. Used when this picker mounts inside
   * a specific activity (YouTube or Screen Share), so the host doesn't see
   * the other choice. Omit to keep both choices visible (legacy behavior).
   */
  lockedKind?: 'youtube' | 'screen-share';
}

/**
 * Empty state of a watch activity. Two flavors:
 *  - YouTube: a URL field that detects the video id and starts the party.
 *  - Screen share: a single button that triggers `getDisplayMedia` from the
 *    click event (the gesture would expire if we deferred this to a
 *    `useEffect` after the round-trip).
 */
export function WatchSourcePicker({
  onStart,
  isStarting,
  lockedKind,
}: WatchSourcePickerProps): React.JSX.Element {
  const [url, setUrl] = useState('');
  const [sharingScreen, setSharingScreen] = useState(false);
  const { localParticipant } = useLocalParticipant();

  const showYouTube = lockedKind === undefined || lockedKind === 'youtube';
  const showScreen = lockedKind === undefined || lockedKind === 'screen-share';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const source = detectWatchSource(url);
    if (!source) {
      toast.error("Couldn't read that link. Try a YouTube URL or a direct video file.");
      return;
    }
    onStart({ kind: source.kind, url: source.url, title: null });
  };

  const handleShareScreen = async (): Promise<void> => {
    if (sharingScreen) return;
    setSharingScreen(true);
    try {
      await localParticipant.setScreenShareEnabled(true);
      const pub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (!pub || !pub.track) return;
      onStart({ kind: 'screen', url: 'livekit:screen-share', title: 'Shared screen' });
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Screen share permission denied.'
          : "Couldn't start screen share. Try again.";
      void localParticipant.setScreenShareEnabled(false).catch(() => undefined);
      toast.error(message);
    } finally {
      setSharingScreen(false);
    }
  };

  const isYouTubeHeader = lockedKind !== 'screen-share';
  const headerTitle =
    lockedKind === 'screen-share'
      ? 'Share your screen with the room'
      : lockedKind === 'youtube'
        ? 'Pick a YouTube video'
        : 'Pick something to watch';
  const headerBlurb =
    lockedKind === 'screen-share'
      ? 'Pick a window or tab — everyone in voice will see it in real time.'
      : lockedKind === 'youtube'
        ? 'Paste a YouTube link. Everyone in voice will watch in sync.'
        : 'Paste a YouTube link or a direct video file. Everyone in the channel will see the same thing, in sync.';

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 py-12 text-center">
      <span
        className="bg-glass-surface-1 border-glass-border flex size-16 items-center justify-center rounded-full border"
        aria-hidden
      >
        {isYouTubeHeader ? (
          <YouTubeBrandMark className="w-9" />
        ) : (
          <MonitorUp className="text-ink-muted size-7" />
        )}
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-ink text-subhead font-semibold">{headerTitle}</h2>
        <p className="text-ink-muted text-caption max-w-md">{headerBlurb}</p>
      </div>

      {showYouTube ? (
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-md flex-col gap-3"
          aria-label="Start a watch party"
        >
          <div className="relative">
            <Link2
              className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="url"
              value={url}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="bg-surface-composer pl-9"
              disabled={isStarting}
              aria-label="Video URL"
              required
              autoFocus
            />
          </div>
          <Button type="submit" disabled={isStarting || url.trim() === ''}>
            {isStarting ? 'Starting…' : 'Start watching'}
          </Button>
        </form>
      ) : null}

      {showYouTube && showScreen ? (
        <div className="flex items-center gap-3" aria-hidden>
          <span className="bg-glass-border h-px w-12" />
          <span className="text-ink-subtle text-caption">or</span>
          <span className="bg-glass-border h-px w-12" />
        </div>
      ) : null}

      {showScreen ? (
        <Button
          variant={lockedKind === 'screen-share' ? 'default' : 'ghost'}
          onClick={() => {
            void handleShareScreen();
          }}
          disabled={isStarting || sharingScreen}
          className="gap-2"
        >
          <MonitorUp className="size-4" aria-hidden />
          {sharingScreen ? 'Choosing screen…' : 'Share a screen'}
        </Button>
      ) : null}
    </div>
  );
}
