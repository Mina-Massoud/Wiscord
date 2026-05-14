import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type PaneHeaderVariant = 'sidebar' | 'topbar';

interface PaneHeaderProps {
  /** Lead icon — sized by the consumer. */
  icon?: ReactNode;
  /** Title text. The sole semantic element in the bar. */
  title: ReactNode;
  /**
   * Inline secondary text rendered right after the title — e.g.
   * `"5 docs"`, a channel slug, the count of active items. Only used
   * by the `topbar` variant; sidebar titles keep a single line.
   */
  subtitle?: ReactNode;
  /** Optional trailing controls (right-aligned). */
  trailing?: ReactNode;
  /**
   * - `sidebar` (default): `text-control`, used in left-rail titlebars.
   * - `topbar`: `text-subhead`, used over the main pane.
   */
  variant?: PaneHeaderVariant;
  className?: string;
}

/**
 * The shared horizontal header chrome used across the app — sidebar
 * titlebars (`variant="sidebar"`) and main-pane topbars
 * (`variant="topbar"`). Owns the `h-app-titlebar` height, the
 * `border-glass-border` hairline, and the standard padding so every
 * surface sits at the same y-coordinate.
 *
 * If a new surface needs a different height / padding / typography,
 * add a controlled prop here — don't fork the chrome into a fresh
 * `<header>` in feature code.
 */
export function PaneHeader({
  icon,
  title,
  subtitle,
  trailing,
  variant = 'sidebar',
  className,
}: PaneHeaderProps) {
  return (
    <header
      className={cn(
        'border-glass-border h-app-titlebar flex shrink-0 items-center gap-2 border-b px-4 py-5',
        className,
      )}
    >
      {icon}
      <span
        className={cn(
          'text-ink min-w-0 truncate font-semibold',
          variant === 'sidebar' ? 'text-control flex-1' : 'text-subhead',
        )}
      >
        {title}
      </span>
      {subtitle ? (
        <span className="text-ink-subtle text-caption ml-0 min-w-0 truncate">{subtitle}</span>
      ) : null}
      {(trailing || variant === 'topbar') && <span className="ml-auto" />}
      {trailing}
    </header>
  );
}
