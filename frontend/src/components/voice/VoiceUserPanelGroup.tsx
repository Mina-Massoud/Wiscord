import { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useConnectionState } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

import { UserPanel } from '@/components/app-shell/UserPanel';
import type { ActivityDefinition } from '@/components/activity/ActivityRegistry';
import { useConnectedChannelId } from '@/lib/voice-session-store';

import { VoiceStatusRow } from './VoiceStatusRow';

interface VoiceUserPanelGroupProps {
  /**
   * Override the slug shown in the row's subtitle. Defaults to the
   * last six chars of the connected channel id from the store, which
   * is what every surface except the in-channel voice page wants.
   */
  channelSlug?: string;
  /**
   * Wires the activity launcher button. Provided by the voice page,
   * omitted on every other page.
   */
  onActivitySelect?: (activity: ActivityDefinition) => void;
  /**
   * Wires the "jump to channel" button. Provided on every non-voice
   * page (so the user can return to the call surface in one click).
   */
  onJump?: () => void;
}

/**
 * The bottom-left card on the voice route. Wraps the Discord-style
 * "Voice Connected" row above the existing UserPanel in one rounded
 * container. The status section animates in/out on connection state.
 * Honors `prefers-reduced-motion`.
 */
export function VoiceUserPanelGroup({
  channelSlug,
  onActivitySelect,
  onJump,
}: VoiceUserPanelGroupProps = {}): React.JSX.Element {
  const state = useConnectionState();
  const reducedMotion = useReducedMotion();
  const connectedChannelId = useConnectedChannelId();

  const resolvedSlug = useMemo(() => {
    if (channelSlug) return channelSlug;
    return connectedChannelId ? connectedChannelId.slice(-6) : '';
  }, [channelSlug, connectedChannelId]);

  const isLive =
    Boolean(connectedChannelId) &&
    (state === ConnectionState.Connected ||
      state === ConnectionState.Connecting ||
      state === ConnectionState.Reconnecting);

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

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
            <div className="border-border border-b">
              <VoiceStatusRow
                channelSlug={resolvedSlug}
                onActivitySelect={onActivitySelect}
                onJump={onJump}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <UserPanel variant="inset" />
    </div>
  );
}
