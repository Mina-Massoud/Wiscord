import { PresenceDot, type Presence } from '@/components/app-shell/atoms/PresenceDot';
import { usePresence } from '@/queries/presence';

interface DmHeaderPresenceProps {
  /** The DM recipient's user id. */
  userId: string;
}

const PRESENCE_TEXT: Record<Presence, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

/**
 * Live presence badge for the DM header — the recipient's real status from the
 * presence snapshot + Socket.IO `presence:changed` stream, not a hardcoded dot.
 * Falls back to `offline` until the snapshot lands or for unknown users.
 */
export function DmHeaderPresence({ userId }: DmHeaderPresenceProps): React.JSX.Element {
  const { data: presenceMap } = usePresence([userId]);
  const status: Presence = presenceMap?.[userId] ?? 'offline';

  return (
    <div className="flex items-center gap-1.5">
      <PresenceDot presence={status} size={10} ringClassName="ring-transparent" />
      <span className="text-ink-subtle text-caption">{PRESENCE_TEXT[status]}</span>
    </div>
  );
}
