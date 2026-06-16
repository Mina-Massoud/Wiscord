import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useActivityPick } from '@/hooks/useActivityPick';
import { useConnectedChannelId, useVoiceHome } from '@/lib/voice-session-store';
import { VoiceUserPanelGroup } from '@/components/voice/VoiceUserPanelGroup';

/**
 * The bottom-left user panel slot for every authed page in the app.
 *
 * Reads voice state from the global voice session store and decides:
 *
 *   - Not in voice → plain user card (VoiceUserPanelGroup collapses
 *     the voice section to zero height when no channel is set).
 *   - In voice, on the voice channel's route → no jump button.
 *   - In voice, on any other route → jump button is shown.
 *
 * Activity picks route through the shared `useActivityPick` hook so
 * the confirm-before-switch flow lands here too (not just inside the
 * voice page).
 */
export function GlobalUserPanel(): React.JSX.Element {
  const channelId = useConnectedChannelId();
  const voiceHome = useVoiceHome();
  const location = useLocation();
  const navigate = useNavigate();
  const { pickActivity, confirmDialog } = useActivityPick();

  // Where "jump to voice" lands — the channel's recorded home (server channel
  // route or labs voice route), falling back to the labs route defensively.
  const jumpTarget = voiceHome ?? (channelId ? `/app/labs/voice/${channelId}` : null);
  const onChannelRoute = jumpTarget ? location.pathname === jumpTarget : false;

  const handleJump = useCallback(() => {
    if (!jumpTarget) return;
    void navigate(jumpTarget);
  }, [jumpTarget, navigate]);

  return (
    <>
      <VoiceUserPanelGroup
        onJump={onChannelRoute ? undefined : handleJump}
        onActivitySelect={channelId ? pickActivity : undefined}
      />
      {confirmDialog}
    </>
  );
}
