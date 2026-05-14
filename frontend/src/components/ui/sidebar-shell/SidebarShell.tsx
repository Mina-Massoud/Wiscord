import type { ReactNode } from 'react';

import { PaneHeader } from '@/components/ui/pane-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

interface SidebarRootProps {
  children: ReactNode;
  className?: string;
}

function SidebarRoot({ children, className }: SidebarRootProps) {
  return <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>;
}

interface SidebarHeaderProps {
  /** Lead icon — sized by the consumer. */
  icon?: ReactNode;
  /** Title text. The sole semantic element in the titlebar. */
  title: ReactNode;
  /** Optional trailing controls (buttons, badges). */
  trailing?: ReactNode;
  className?: string;
}

function SidebarHeader({ icon, title, trailing, className }: SidebarHeaderProps) {
  return (
    <PaneHeader
      variant="sidebar"
      icon={icon}
      title={title}
      trailing={trailing}
      className={className}
    />
  );
}

interface SidebarBodyProps {
  children: ReactNode;
  className?: string;
}

/**
 * Scrollable column under the titlebar. Owns the rhythm between the
 * titlebar divider and the first child — `pt-4` is the breathing room
 * that keeps section headers from kissing the divider. Don't override
 * `pt` in consumers; if a surface needs different spacing, lift the
 * value into a prop here.
 */
function SidebarBody({ children, className }: SidebarBodyProps) {
  return (
    <div className={cn('flex flex-1 flex-col gap-3 overflow-auto px-2 pt-4 pb-3', className)}>
      {children}
    </div>
  );
}

interface SidebarSectionProps {
  /** Uppercase label rendered above the section. */
  title?: ReactNode;
  /** Optional trailing controls beside the section title. */
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

function SidebarSection({ title, trailing, children, className }: SidebarSectionProps) {
  return (
    <section className={cn('flex flex-col gap-1', className)}>
      {(title || trailing) && (
        <div className="flex items-center justify-between px-2 py-1">
          {title ? <SidebarSectionHeader>{title}</SidebarSectionHeader> : <span />}
          {trailing}
        </div>
      )}
      {children}
    </section>
  );
}

interface SidebarSectionHeaderProps {
  children: ReactNode;
  className?: string;
}

function SidebarSectionHeader({ children, className }: SidebarSectionHeaderProps) {
  return (
    <span
      className={cn('text-ink-subtle text-badge font-semibold tracking-wider uppercase', className)}
    >
      {children}
    </span>
  );
}

interface SidebarMessageProps {
  children: ReactNode;
  className?: string;
}

function SidebarEmpty({ children, className }: SidebarMessageProps) {
  return <p className={cn('text-ink-muted text-caption px-2 py-2', className)}>{children}</p>;
}

function SidebarError({ children, className }: SidebarMessageProps) {
  return <p className={cn('text-ink-muted text-caption px-2 py-1', className)}>{children}</p>;
}

interface SidebarListSkeletonProps {
  /** How many skeleton rows to render. */
  rows?: number;
  /** Override leading dot size — defaults to a 1.5 round indicator. */
  dotClassName?: string;
}

/**
 * Skeleton shaped like a generic "leading indicator + two-line label"
 * sidebar row. Used by Quiz / Notes / Whiteboard sidebars while their
 * lists load.
 */
function SidebarListSkeleton({ rows = 4, dotClassName }: SidebarListSkeletonProps) {
  return (
    <div className="flex flex-col gap-1 px-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-2 px-1.5 py-2">
          <Skeleton className={cn('mt-1.5 size-1.5 rounded-full', dotClassName)} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const Sidebar = {
  Root: SidebarRoot,
  Header: SidebarHeader,
  Body: SidebarBody,
  Section: SidebarSection,
  SectionHeader: SidebarSectionHeader,
  Empty: SidebarEmpty,
  Error: SidebarError,
  ListSkeleton: SidebarListSkeleton,
};
