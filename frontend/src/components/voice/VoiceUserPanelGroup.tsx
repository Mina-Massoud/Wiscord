import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { AudioWaveform, PhoneOff, Signal } from 'lucide-react';

import { UserPanel } from '@/components/app-shell/UserPanel';
import { useCopy } from '@/lib/copy/useCopy';

interface VoiceUserPanelGroupProps {
  channelSlug: string;
}

/**
 * The bottom-left card on the voice route. Wraps the Discord-style
 * "Voice Connected" section *and* the existing UserPanel into one shared
 * rounded container, with a divider between them. The connected section
 * animates in/out with a height + fade transition (Framer Motion); the
 * outer card grows naturally to accommodate it.
 *
 * Honors `prefers-reduced-motion` — collapses the transition to 0ms.
 */
export function VoiceUserPanelGroup({ channelSlug }: VoiceUserPanelGroupProps): React.JSX.Element {
  const state = useConnectionState();
  const room = useRoomContext();
  const reducedMotion = useReducedMotion();
  const t = useCopy();

  const isConnected = state === ConnectionState.Connected;

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <div className="bg-glass-callout border-glass-border mx-2 mb-2 overflow-hidden rounded-lg border">
      <AnimatePresence initial={false}>
        {isConnected ? (
          <motion.div
            key="voice-section"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-glass-border flex items-center gap-3 border-b px-3 py-2.5">
              <span
                className="bg-success/15 flex size-9 shrink-0 items-center justify-center rounded-md"
                aria-hidden
              >
                <Signal className="text-success size-5" />
              </span>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-success text-control leading-tight font-semibold">
                  {t('voicePanel.connected.title')}
                </span>
                <span className="text-ink-muted text-caption truncate leading-tight">
                  Voice / {channelSlug}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <span
                  className="text-ink-muted flex size-8 items-center justify-center"
                  aria-hidden
                  title="Audio active"
                >
                  <AudioWaveform className="size-4" />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void room.disconnect();
                  }}
                  aria-label="Disconnect from voice"
                  className="text-ink-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <PhoneOff className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <UserPanel variant="inset" />
    </div>
  );
}
