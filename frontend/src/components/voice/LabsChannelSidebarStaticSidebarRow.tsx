import { type VoiceChannelParticipant } from '@/queries/voice-presence';
import { ActivityHostIndicator } from './LabsChannelSidebarActivityHostIndicator';
import { SidebarRowShell } from './LabsChannelSidebarSidebarRowShell';

interface StaticSidebarRowProps {
  row: VoiceChannelParticipant;
  isMe: boolean;
  isActivityHost: boolean;
  dimmed?: boolean;
}

export function StaticSidebarRow({
  row,
  isMe,
  isActivityHost,
  dimmed = false,
}: StaticSidebarRowProps) {
  const displayName = row.name?.trim() || row.identity || 'Unknown';
  return (
    <SidebarRowShell seed={row.identity || displayName} dimmed={dimmed}>
      <span className="text-ink-muted text-tab min-w-0 flex-1 truncate">
        {displayName}
        {isMe ? <span className="ml-1 opacity-60">· you</span> : null}
      </span>
      {isActivityHost ? <ActivityHostIndicator /> : null}
    </SidebarRowShell>
  );
}
