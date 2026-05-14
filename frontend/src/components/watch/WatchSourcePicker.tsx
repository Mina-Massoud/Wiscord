import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Link2, MonitorUp, Tv2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { detectWatchSource } from '@/lib/watch-source';
import { toast } from '@/lib/toast';

import type { WatchSourceKind } from '@/queries/client';

interface WatchSourcePickerProps {
  onStart: (input: { kind: WatchSourceKind; url: string; title: string | null }) => void;
  isStarting: boolean;
}

/**
 * Empty state of the watch surface: a URL field that detects YouTube or
 * direct media URLs and starts the party. Copy is warm and human, not
 * "Enter source URL."
 *
 * Validation is silent until submit — we don't surface a red error band
 * just for an in-progress paste. Failure to detect = toast on submit.
 */
export function WatchSourcePicker({
  onStart,
  isStarting,
}: WatchSourcePickerProps): React.JSX.Element {
  const [url, setUrl] = useState('');
  const [sharingScreen, setSharingScreen] = useState(false);
  const { localParticipant } = useLocalParticipant();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const source = detectWatchSource(url);
    if (!source) {
      toast.error("Couldn't read that link. Try a YouTube URL or a direct video file.");
      return;
    }
    onStart({ kind: source.kind, url: source.url, title: null });
  };

  /**
   * Trigger `getDisplayMedia` from the *click* so the user gesture is
   * preserved. If we let `ScreenShareSource` request the picker from a
   * `useEffect` after the party document round-trips through the
   * backend, the gesture has expired and the browser silently refuses.
   * Only start the party once the host has actually selected a source.
   */
  const handleShareScreen = async (): Promise<void> => {
    if (sharingScreen) return;
    setSharingScreen(true);
    try {
      await localParticipant.setScreenShareEnabled(true);
      const pub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (!pub || !pub.track) {
        // User opened the picker and dismissed it without choosing.
        // No track to share — bail without creating a party.
        return;
      }
      // Source URL is a placeholder for the screen kind — the actual
      // stream rides on the LiveKit track we just published. The
      // backend schema still requires a non-empty URL string.
      onStart({ kind: 'screen', url: 'livekit:screen-share', title: 'Shared screen' });
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Screen share permission denied.'
          : "Couldn't start screen share. Try again.";
      // Quietly stop the publication if it got partially established.
      void localParticipant.setScreenShareEnabled(false).catch(() => undefined);
      toast.error(message);
    } finally {
      setSharingScreen(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 py-12 text-center">
      <span
        className="bg-glass-surface-1 border-glass-border flex size-16 items-center justify-center rounded-full border"
        aria-hidden
      >
        <Tv2 className="text-ink-muted size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-ink text-subhead font-semibold">Pick something to watch</h2>
        <p className="text-ink-muted text-caption max-w-md">
          Paste a YouTube link or a direct video file. Everyone in the channel will see the same
          thing, in sync.
        </p>
      </div>

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

      <div className="flex items-center gap-3" aria-hidden>
        <span className="bg-glass-border h-px w-12" />
        <span className="text-ink-subtle text-caption">or</span>
        <span className="bg-glass-border h-px w-12" />
      </div>

      <Button
        variant="ghost"
        onClick={() => {
          void handleShareScreen();
        }}
        disabled={isStarting || sharingScreen}
        className="gap-2"
      >
        <MonitorUp className="size-4" aria-hidden />
        {sharingScreen ? 'Choosing screen…' : 'Share a screen'}
      </Button>
    </div>
  );
}
