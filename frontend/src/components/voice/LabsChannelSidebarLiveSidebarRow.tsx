import { useIsSpeaking } from '@livekit/components-react';
import { MicOff } from 'lucide-react';
import { type VoiceChannelParticipant } from '@/queries/voice-presence';
import { type Participant } from 'livekit-client';
import { ActivityHostIndicator } from './LabsChannelSidebarActivityHostIndicator';
import { SidebarRowShell } from './LabsChannelSidebarSidebarRowShell';

interface LiveSidebarRowProps {
  row: VoiceChannelParticipant;
  participant: Participant;
  isActivityHost: boolean;
  dimmed?: boolean;
}

export function LiveSidebarRow({
  row,
  participant,
  isActivityHost,
  dimmed = false,
}: LiveSidebarRowProps) {
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = participant.isMicrophoneEnabled === false;
  const displayName =
    (participant.name ?? '').trim() || row.name?.trim() || participant.identity || 'Unknown';
  const seed = participant.identity || row.identity || displayName;

  return (
    <SidebarRowShell seed={seed} isSpeaking={isSpeaking} dimmed={dimmed}>
      <span className="text-ink-muted text-tab min-w-0 flex-1 truncate">
        {displayName}
        {participant.isLocal ? <span className="ml-1 opacity-60">· you</span> : null}
      </span>
      {isMuted ? (
        <MicOff className="text-destructive size-3.5 shrink-0" aria-label="Muted" />
      ) : null}
      {isActivityHost ? <ActivityHostIndicator /> : null}
    </SidebarRowShell>
  );
}
