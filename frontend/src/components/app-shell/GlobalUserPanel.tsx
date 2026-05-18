import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useActivityPick } from '@/hooks/useActivityPick';
import { useConnectedChannelId } from '@/lib/voice-session-store';
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
  const location = useLocation();
  const navigate = useNavigate();
  const { pickActivity, confirmDialog } = useActivityPick();

  const onChannelRoute = channelId ? location.pathname === `/app/labs/voice/${channelId}` : false;

  const handleJump = useCallback(() => {
    if (!channelId) return;
    void navigate(`/app/labs/voice/${channelId}`);
  }, [channelId, navigate]);

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
