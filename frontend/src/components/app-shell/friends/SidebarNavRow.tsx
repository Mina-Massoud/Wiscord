import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';

interface SidebarNavRowProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Optional trailing badge (e.g. "32", "NEW"). */
  trailing?: React.ReactNode;
  /** When true, paints the active surface even outside route match. */
  forceActive?: boolean;
  /** When defined, fully controls the active state (overrides NavLink's route
   *  match). Use when several rows share a pathname but differ by search param. */
  match?: boolean;
  /** When true, renders end-prop on NavLink so /app doesn't activate on /app/foo. */
  end?: boolean;
}

/**
 * Reusable row at the top of the friends/DM sidebar (Friends, Message Requests, Nitro, etc).
 * Active state paints surface-active + ink text; hover paints surface-hover.
 */
export function SidebarNavRow({
  to,
  label,
  icon,
  trailing,
  forceActive = false,
  match,
  end = false,
}: SidebarNavRowProps): React.JSX.Element {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => {
        const active = match !== undefined ? match : isActive || forceActive;
        return cn(
          'text-control mx-2 flex h-[42px] items-center gap-3 rounded-md px-2 font-medium transition-colors',
          'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:outline-none',
          active
            ? 'bg-glass-active text-ink'
            : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
        );
      }}
    >
      <span className="flex size-6 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </NavLink>
  );
}
