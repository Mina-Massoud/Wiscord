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
 * Tight single-line presence chip pinned at the editor footer.
 *
 * Two modes:
 *   - peer present → colored avatar dot + name + "is editing · 4s ago"
 *   - nobody else  → quiet connection state line
 *
 * Single-line by design: with a long display name like "Alice (voice test)"
 * the previous stacked layout wrapped onto two lines and looked like a
 * broken pill. Truncating the name with `max-w` + `truncate` keeps the
 * footer at one row regardless of how many peers cycle through.
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
        'text-ink-muted text-caption flex min-w-0 items-center gap-2 whitespace-nowrap select-none',
        className,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full transition-colors', dotColor)}
        aria-hidden
      />
      {state ? (
        <>
          <span
            className="ring-canvas h-4 w-4 shrink-0 rounded-full ring-2"
            style={{ backgroundColor: state.user.color }}
            aria-hidden
          />
          <span className="text-ink max-w-[14rem] truncate font-medium">{state.user.name}</span>
          <span className="text-ink-subtle shrink-0">
            is editing · {formatRelative(new Date(state.at).toISOString())}
          </span>
        </>
      ) : (
        <>
          <Pencil className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
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
