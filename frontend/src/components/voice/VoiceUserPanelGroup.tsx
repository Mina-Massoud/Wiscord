import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { Loader2, PhoneOff, Signal } from 'lucide-react';

import { UserPanel } from '@/components/app-shell/UserPanel';
import { ActivityLauncherButton } from '@/components/activity/ActivityLauncherButton';
import type { ActivityDefinition } from '@/components/activity/ActivityRegistry';
import { cn } from '@/lib/cn';
import { useCopy } from '@/lib/copy/useCopy';

import { VoiceMicStatusButton } from './VoiceMicStatusButton';

interface VoiceUserPanelGroupProps {
  channelSlug: string;
  /**
   * Fires when the user picks an activity from the launcher dialog. Omit to
   * hide the launcher icon in the connected row.
   */
  onActivitySelect?: (activity: ActivityDefinition) => void;
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
export function VoiceUserPanelGroup({
  channelSlug,
  onActivitySelect,
}: VoiceUserPanelGroupProps): React.JSX.Element {
  const state = useConnectionState();
  const room = useRoomContext();
  const reducedMotion = useReducedMotion();
  const t = useCopy();

  const isConnected = state === ConnectionState.Connected;
  const isConnecting = state === ConnectionState.Connecting;
  const isReconnecting = state === ConnectionState.Reconnecting;
  const isLive = isConnected || isConnecting || isReconnecting;

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

  const title = isConnected
    ? t('voicePanel.connected.title')
    : isReconnecting
      ? t('voicePanel.reconnecting.title')
      : t('voicePanel.connecting.title');

  // Title color and icon track the live state. Connected = success
  // (green Signal); Connecting/Reconnecting = blurple (spinner) so the
  // card visibly reads as "in progress" rather than "you're already in."
  const titleColorClass = isConnected ? 'text-success' : 'text-blurple';
  const iconBgClass = isConnected ? 'bg-success/15' : 'bg-blurple/15';

  return (
    <div className="bg-surface-2 border-border shadow-elevated mx-3 mb-3 overflow-hidden rounded-lg border">
      <AnimatePresence initial={false}>
        {isLive ? (
          <motion.div
            key="voice-section"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-border flex items-center gap-3 border-b px-3 py-2.5">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-md',
                  iconBgClass,
                )}
                aria-hidden
              >
                {isConnected ? (
                  <Signal className="text-success size-5" />
                ) : (
                  <Loader2 className="text-blurple size-5 animate-spin" />
                )}
              </span>

              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn('text-control leading-tight font-semibold', titleColorClass)}
                  aria-live="polite"
                >
                  {title}
                </span>
                <span className="text-ink-muted text-caption truncate leading-tight">
                  Voice / {channelSlug}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {isConnected ? <VoiceMicStatusButton /> : null}
                {isConnected && onActivitySelect ? (
                  <ActivityLauncherButton
                    onActivitySelect={onActivitySelect}
                    className="text-ink-muted hover:bg-glass-hover hover:text-ink size-8 rounded-md"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void room.disconnect();
                  }}
                  aria-label={isConnected ? 'Disconnect from voice' : 'Cancel join'}
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
