import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/date';

import type { NotesLastEditedBy } from './useNotesLastEditedBy';

interface NotesLastEditedByProps {
  /** Result from `useNotesLastEditedBy`. */
  state: NotesLastEditedBy | null;
  /** Connection status — drives the leading dot color. */
  status: 'connecting' | 'connected' | 'disconnected';
  className?: string;
}

/**
 * Subtle inline pill at the editor's footer. Two modes:
 *   - someone else is here → "Maya is editing"
 *   - nobody else → "Last saved {relative}"
 *
 * The relative-time string is recomputed every 30s by ticking a local state
 * so "just now" decays to "1 minute ago" without a parent re-render.
 */
export function NotesLastEditedBy({
  state,
  status,
  className,
}: NotesLastEditedByProps): React.JSX.Element {
  const [, tick] = useState(0);
  useEffect(() => {
    // Re-render every 30s so the relative time string stays fresh.
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const dotColor =
    status === 'connected'
      ? 'bg-presence-online'
      : status === 'connecting'
        ? 'bg-presence-idle'
        : 'bg-presence-offline';

  return (
    <div
      className={cn(
        'text-ink-muted text-caption flex items-center gap-2 select-none',
        className,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full transition-colors', dotColor)}
        aria-hidden
      />
      {state ? (
        <>
          <span
            className="h-2 w-2 rounded-full ring-2 ring-black/20"
            style={{ backgroundColor: state.user.color }}
            aria-hidden
          />
          <span className="text-ink">{state.user.name}</span>
          <span>is editing · {formatRelative(new Date(state.at).toISOString())}</span>
        </>
      ) : (
        <>
          <Pencil className="size-3" aria-hidden />
          <span>
            {status === 'connected'
              ? 'You’re the only one here'
              : status === 'connecting'
                ? 'Reconnecting…'
                : 'Offline'}
          </span>
        </>
      )}
    </div>
  );
}
