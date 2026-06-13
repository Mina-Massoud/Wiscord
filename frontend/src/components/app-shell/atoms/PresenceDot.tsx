import { cn } from '@/lib/cn';

/** UI presence states. Superset of the backend `PresenceStatus` — `dnd` is a
 *  reserved render state that no v1 source emits yet. */
export type Presence = 'online' | 'idle' | 'dnd' | 'offline';

interface PresenceDotProps {
  presence: Presence;
  /** Outer dot size in px. The mask ring is drawn 2px smaller. */
  size?: number;
  /** Ring color around the dot — should match the surface the dot sits on. */
  ringClassName?: string;
  className?: string;
}

const PRESENCE_BG: Record<Presence, string> = {
  online: 'bg-presence-online',
  idle: 'bg-presence-idle',
  dnd: 'bg-presence-dnd',
  offline: 'bg-presence-offline',
};

const PRESENCE_LABEL: Record<Presence, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

/**
 * Discord-style presence dot rendered absolutely-positioned over an avatar.
 * Caller is responsible for positioning (parent must be `relative`).
 */
export function PresenceDot({
  presence,
  size = 12,
  ringClassName = 'ring-surface-1',
  className,
}: PresenceDotProps): React.JSX.Element {
  return (
    <span
      aria-label={PRESENCE_LABEL[presence]}
      role="status"
      style={{ width: size, height: size }}
      className={cn(
        'block rounded-full ring-[3px]',
        PRESENCE_BG[presence],
        ringClassName,
        className,
      )}
    />
  );
}
