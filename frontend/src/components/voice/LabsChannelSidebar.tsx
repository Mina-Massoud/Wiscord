import { useMemo } from 'react';
import { useConnectionState, useIsSpeaking, useParticipants } from '@livekit/components-react';
import { ConnectionState, type Participant } from 'livekit-client';
import { Volume2, MicOff, Rocket } from 'lucide-react';

import { useMyProfile } from '@/queries/profile';
import {
  useVoiceChannelParticipants,
  type VoiceChannelParticipant,
} from '@/queries/voice-presence';
import { Sidebar } from '@/components/ui/sidebar-shell';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
 *
 * Outer shell / titlebar / scroll body come from `Sidebar.*` so this
 * surface stays in lockstep with Quiz / Notes / Whiteboard rhythm.
 */
export function LabsChannelSidebar({
  channelId,
  channelSlug,
  active,
  onActivate,
}: LabsChannelSidebarProps) {
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

  // Optimistic-join state: when the user clicks Join, they should see
  // themselves listed under the channel immediately at reduced opacity,
  // even before LiveKit reports them connected. Once the server presence
  // sweep lists them (or LiveKit reports Connected), the dimmed style
  // lifts. Same animation regardless of which signal lands first.
  const isConnecting = active && state !== ConnectionState.Connected;
  const meInRows = me ? rows.some((r) => r.identity === me.id) : false;
  const showOptimisticMe = active && !!me && !meInRows;

  return (
    <Sidebar.Root>
      <Sidebar.Header title="Labs · Voice" />

      <Sidebar.Body>
        <Sidebar.Section title="Voice Channels">
          <button
            type="button"
            onClick={onActivate}
            disabled={active}
            aria-pressed={active}
            className={cn(
              'duration-fast compact:gap-2 compact:py-1 spacious:gap-3.5 spacious:py-3 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
              active
                ? 'bg-surface-active text-ink cursor-default'
                : 'text-ink-muted hover:bg-glass-hover hover:text-ink focus-visible:ring-blurple cursor-pointer focus-visible:ring-2 focus-visible:outline-none',
            )}
          >
            <Volume2
              className={cn('size-5 shrink-0', active ? 'text-ink-muted' : 'text-ink-subtle')}
              aria-hidden
            />
            <span className="text-subhead min-w-0 flex-1 truncate font-medium">{channelSlug}</span>
          </button>

          {rows.length > 0 || showOptimisticMe ? (
            <ul className="compact:mt-0.5 compact:gap-0 spacious:mt-1.5 spacious:gap-1 mt-1 flex flex-col gap-0.5 pl-7">
              {showOptimisticMe && me ? (
                <OptimisticMeRow
                  identity={me.id}
                  displayName={me.display_name ?? me.username ?? 'You'}
                />
              ) : null}
              {rows.map((row) => {
                const live = liveByIdentity.get(row.identity);
                // Per-user activity presence drives the rocket — the
                // server doc is only set for host-led kinds, but Notes /
                // Whiteboard openers should still get the indicator.
                const isInActivity = row.activityKind !== null;
                const isMe = row.identity === me?.id;
                const dimmed = isMe && isConnecting;
                return live ? (
                  <LiveSidebarRow
                    key={row.identity}
                    row={row}
                    participant={live}
                    isActivityHost={isInActivity}
                    dimmed={dimmed}
                  />
                ) : (
                  <StaticSidebarRow
                    key={row.identity}
                    row={row}
                    isMe={isMe}
                    isActivityHost={isInActivity}
                    dimmed={dimmed}
                  />
                );
              })}
            </ul>
          ) : null}
        </Sidebar.Section>
      </Sidebar.Body>
    </Sidebar.Root>
  );
}

interface StaticSidebarRowProps {
  row: VoiceChannelParticipant;
  isMe: boolean;
  isActivityHost: boolean;
  dimmed?: boolean;
}

function StaticSidebarRow({ row, isMe, isActivityHost, dimmed = false }: StaticSidebarRowProps) {
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

interface LiveSidebarRowProps {
  row: VoiceChannelParticipant;
  participant: Participant;
  isActivityHost: boolean;
  dimmed?: boolean;
}

function LiveSidebarRow({ row, participant, isActivityHost, dimmed = false }: LiveSidebarRowProps) {
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

interface OptimisticMeRowProps {
  identity: string;
  displayName: string;
}

/**
 * Ghost row rendered between the moment the user clicks Join and the
 * moment they show up in the server-side presence sweep (or LiveKit
 * reports Connected). Same shell, same avatar, lower opacity — gives the
 * feeling that the click landed without waiting on the round-trip.
 */
function OptimisticMeRow({ identity, displayName }: OptimisticMeRowProps) {
  return (
    <SidebarRowShell seed={identity || displayName} dimmed>
      <span className="text-ink-muted text-control min-w-0 flex-1 truncate">
        {displayName}
        <span className="ml-1 opacity-60">· you</span>
      </span>
    </SidebarRowShell>
  );
}

/**
 * Small blurple rocket overlay on a participant row whose `activityKind`
 * is non-null. The one blurple beat on this surface — it signals "this
 * person is in some activity" to other users so they know there's
 * something to join from the voice grid.
 */
function ActivityHostIndicator() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="text-blurple inline-flex shrink-0 items-center"
          aria-label="Hosting an activity"
        >
          <Rocket className="size-3" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>Hosting an activity</TooltipContent>
    </Tooltip>
  );
}

interface SidebarRowShellProps {
  seed: string;
  isSpeaking?: boolean;
  dimmed?: boolean;
  children: React.ReactNode;
}

function SidebarRowShell({
  seed,
  isSpeaking = false,
  dimmed = false,
  children,
}: SidebarRowShellProps) {
  return (
    <li
      className={cn(
        'hover:bg-glass-hover duration-base compact:gap-2 compact:py-0.5 spacious:gap-3 spacious:py-2.5 flex items-center gap-3 rounded-md px-2 py-1.5 transition-[opacity,background-color]',
        dimmed ? 'opacity-50' : 'opacity-100',
      )}
    >
      <img
        src={getIdenticonDataUrl(seed, 64)}
        alt=""
        width={24}
        height={24}
        className={cn(
          'duration-base size-6 shrink-0 rounded-full transition-shadow',
          isSpeaking && 'ring-success ring-2 ring-offset-0',
        )}
        aria-hidden
      />
      {children}
    </li>
  );
}
