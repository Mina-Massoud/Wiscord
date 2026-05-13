import { cn } from '@/lib/cn';

interface UnreadBadgeProps {
  count: number;
  /** When true, renders the small red dot instead of a numeric badge. */
  asDot?: boolean;
  className?: string;
}

/**
 * Red numeric badge used on server rail icons and DM rows.
 * 99+ caps. Border matches the surface beneath the badge.
 */
export function UnreadBadge({
  count,
  asDot = false,
  className,
}: UnreadBadgeProps): React.JSX.Element | null {
  if (count <= 0) return null;

  if (asDot) {
    return (
      <span
        aria-label={`${count} unread`}
        className={cn(
          'border-surface-2 bg-destructive block size-2 rounded-full border-2',
          className,
        )}
      />
    );
  }

  const label = count > 99 ? '99+' : String(count);

  return (
    <span
      aria-label={`${count} unread`}
      className={cn(
        'border-surface-2 bg-destructive flex h-4 min-w-4 items-center justify-center rounded-full border-2 px-1 text-[12px] leading-none font-bold text-white',
        className,
      )}
    >
      {label}
    </span>
  );
}
