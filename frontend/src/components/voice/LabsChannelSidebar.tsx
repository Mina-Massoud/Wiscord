import { useMemo } from 'react';
import { useConnectionState, useIsSpeaking, useParticipants } from '@livekit/components-react';
import { ConnectionState, type Participant } from 'livekit-client';
import { Volume2, MicOff } from 'lucide-react';

import { useMyProfile } from '@/queries/profile';
import {
  useVoiceChannelParticipants,
  type VoiceChannelParticipant,
} from '@/queries/voice-presence';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { cn } from '@/lib/cn';

interface LabsChannelSidebarProps {
  channelId: string;
  channelSlug: string;
  /**
   * Reflects whether the local user *intends* to be in the channel (clicked
   * Join). Used to highlight the channel row in its active state and to
   * disable the row's button while connected so it doesn't act as a no-op
   * "rejoin" trigger.
   */
  active: boolean;
  /** Fired when the row is clicked while inactive. */
  onActivate: () => void;
}

/**
 * Sidebar for the voice lab route. Renders a single voice channel row with
 * the live participant list indented underneath — the Discord shape.
 *
 * Source of truth is the **server-side presence store** (`useVoiceChannelParticipants`).
 * Every signed-in viewer sees the same roster regardless of whether they
 * have a LiveKit connection — so opening a channel doesn't require minting
 * a LiveKit session just to populate the sidebar.
 *
 * When the local user *is* connected we layer the LiveKit `Participant`
 * object on top, keyed by identity, so we can render speaking-ring and mic
 * state in real time. Remote rows that don't match a LiveKit participant
 * (because we're not connected) fall back to a static row.
 */
export function LabsChannelSidebar({
  channelId,
  channelSlug,
  active,
  onActivate,
}: LabsChannelSidebarProps): React.JSX.Element {
  const presence = useVoiceChannelParticipants(channelId);
  const state = useConnectionState();
  const liveParticipants = useParticipants();
  const me = useMyProfile().data;

  // Build a lookup so we can overlay LiveKit's live participant onto each
  // server-listed row when the local user is connected to the same room.
  const liveByIdentity = useMemo(() => {
    if (state !== ConnectionState.Connected) return new Map<string, Participant>();
    const out = new Map<string, Participant>();
    for (const p of liveParticipants) {
      const key = p.identity || p.sid;
      if (key) out.set(key, p);
    }
    return out;
  }, [state, liveParticipants]);

  const rows = presence.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-glass-border h-app-titlebar flex shrink-0 items-center border-b px-4">
        <span className="text-ink text-control truncate font-semibold">Labs · Voice</span>
      </header>

      <div className="flex flex-1 flex-col gap-1 overflow-auto px-2 py-3">
        <div className="text-ink-subtle text-badge px-2 py-1 font-semibold tracking-wider uppercase">
          Voice Channels
        </div>

        <button
          type="button"
          onClick={onActivate}
          disabled={active}
          aria-pressed={active}
          className={cn(
            'duration-fast flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
            active
              ? 'bg-surface-active text-ink cursor-default'
              : 'text-ink-muted hover:bg-glass-hover hover:text-ink focus-visible:ring-blurple cursor-pointer focus-visible:ring-2 focus-visible:outline-none',
          )}
        >
          <Volume2
            className={cn('size-4 shrink-0', active ? 'text-ink-muted' : 'text-ink-subtle')}
            aria-hidden
          />
          <span className="text-control min-w-0 flex-1 truncate font-medium">{channelSlug}</span>
        </button>

        {rows.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-0.5 pl-6">
            {rows.map((row) => {
              const live = liveByIdentity.get(row.identity);
              return live ? (
                <LiveSidebarRow key={row.identity} row={row} participant={live} />
              ) : (
                <StaticSidebarRow key={row.identity} row={row} isMe={row.identity === me?.id} />
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

interface StaticSidebarRowProps {
  row: VoiceChannelParticipant;
  isMe: boolean;
}

function StaticSidebarRow({ row, isMe }: StaticSidebarRowProps): React.JSX.Element {
  const displayName = row.name?.trim() || row.identity || 'Unknown';
  return (
    <SidebarRowShell seed={row.identity || displayName}>
      <span className="text-ink-muted text-control min-w-0 flex-1 truncate">
        {displayName}
        {isMe ? <span className="ml-1 opacity-60">· you</span> : null}
      </span>
    </SidebarRowShell>
  );
}

interface LiveSidebarRowProps {
  row: VoiceChannelParticipant;
  participant: Participant;
}

function LiveSidebarRow({ row, participant }: LiveSidebarRowProps): React.JSX.Element {
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = participant.isMicrophoneEnabled === false;
  const displayName =
    (participant.name ?? '').trim() || row.name?.trim() || participant.identity || 'Unknown';
  const seed = participant.identity || row.identity || displayName;

  return (
    <SidebarRowShell seed={seed} isSpeaking={isSpeaking}>
      <span className="text-ink-muted text-control min-w-0 flex-1 truncate">
        {displayName}
        {participant.isLocal ? <span className="ml-1 opacity-60">· you</span> : null}
      </span>
      {isMuted ? <MicOff className="text-destructive size-3 shrink-0" aria-label="Muted" /> : null}
    </SidebarRowShell>
  );
}

interface SidebarRowShellProps {
  seed: string;
  isSpeaking?: boolean;
  children: React.ReactNode;
}

function SidebarRowShell({
  seed,
  isSpeaking = false,
  children,
}: SidebarRowShellProps): React.JSX.Element {
  return (
    <li className="hover:bg-glass-hover flex items-center gap-2 rounded-md px-2 py-1 transition-colors">
      <img
        src={getIdenticonDataUrl(seed, 64)}
        alt=""
        width={20}
        height={20}
        className={cn(
          'duration-base size-5 shrink-0 rounded-full transition-shadow',
          isSpeaking && 'ring-success ring-2 ring-offset-0',
        )}
        aria-hidden
      />
      {children}
    </li>
  );
}
