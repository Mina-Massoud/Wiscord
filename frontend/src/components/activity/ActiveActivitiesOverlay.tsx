import { useMemo } from 'react';

import type { ActivityKind, VoiceActivitySnapshot } from '@/queries/client';
import type { VoiceChannelParticipant } from '@/queries/voice-presence';
import { ActivityInProgressCard } from './ActiveActivitiesOverlayActivityInProgressCard';

interface ActiveActivitiesOverlayProps {
  /** Voice-presence rows for everyone in the channel. */
  participants: VoiceChannelParticipant[];
  /** The local user's identity — used to hide their own card. */
  meIdentity: string | null;
  /**
   * The channel's durable host-led activity doc (quiz / youtube / screen-share
   * / pomodoro), or null. This is the *reliable* signal that something is
   * running: a viewer who just opened the channel always gets it from the
   * server, whereas per-user presence `activityKind` is ephemeral and can be
   * missing if the host picked the activity before the presence poller saw
   * them. We surface the host's activity from this doc even when no presence
   * row carries the kind.
   */
  activity?: VoiceActivitySnapshot | null;
  /** Fires when the user clicks "Join" on a card. */
  onJoin: (kind: ActivityKind) => void;
}

export interface ActivityGroup {
  kind: ActivityKind;
  participants: VoiceChannelParticipant[];
}

/**
 * Surfaces "X + N others are in Y" cards at the top of the voice grid so a
 * participant can choose to join someone's active activity without being
 * force-redirected. One card per distinct kind currently in use by *other*
 * voice participants (the local user's own row is filtered out — they can
 * see their own activity directly when they're in it).
 *
 * Empty when nobody else is in an activity — the overlay collapses cleanly
 * via React's null-skip, so consumers don't need to gate the slot.
 */
export function ActiveActivitiesOverlay({
  participants,
  meIdentity,
  activity = null,
  onJoin,
}: ActiveActivitiesOverlayProps): React.JSX.Element | null {
  const groups = useMemo<ActivityGroup[]>(() => {
    const byKind = new Map<ActivityKind, VoiceChannelParticipant[]>();
    for (const p of participants) {
      if (!p.activityKind) continue;
      if (meIdentity && p.identity === meIdentity) continue;
      const list = byKind.get(p.activityKind) ?? [];
      list.push(p);
      byKind.set(p.activityKind, list);
    }

    // The durable activity doc always wins: surface the host-led session even
    // when the host's ephemeral presence kind never landed, so a viewer who
    // just opened the channel still sees "there's a Quiz — join". Skip when
    // the local user is the host (they see their own activity directly).
    if (activity && activity.hostUserId !== meIdentity) {
      const list = byKind.get(activity.kind) ?? [];
      if (!list.some((p) => p.identity === activity.hostUserId)) {
        const hostRow = participants.find((p) => p.identity === activity.hostUserId);
        list.unshift({
          identity: activity.hostUserId,
          name: hostRow?.name ?? 'Host',
          joinedAt: hostRow?.joinedAt ?? 0,
          activityKind: activity.kind,
        });
      }
      byKind.set(activity.kind, list);
    }

    // Preserve a deterministic order — order tiles match the launcher
    // registry order so it doesn't shuffle as users come and go.
    const order: readonly ActivityKind[] = [
      'youtube',
      'screen-share',
      'notes',
      'whiteboard',
      'quiz',
      'pomodoro',
    ];
    return order
      .filter((k) => byKind.has(k))
      .map((k) => ({ kind: k, participants: byKind.get(k) ?? [] }));
  }, [participants, meIdentity, activity]);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <ActivityInProgressCard key={group.kind} group={group} onJoin={onJoin} />
      ))}
    </div>
  );
}
