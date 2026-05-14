interface HoverTimeIndicatorProps {
  /** Y offset (px) inside the day column. */
  y: number;
  /** Time label rendered next to the line, e.g. "10:30 AM". */
  label: string;
}

/**
 * Floating horizontal line + time chip that tracks the pointer while it
 * hovers over a TimeGrid column. The parent column owns the pointer-event
 * listeners and feeds us a computed Y + label so we stay a pure paint.
 *
 * Position is inline because it's a per-frame runtime value, not a static
 * design token.
 */
export function HoverTimeIndicator({ y, label }: HoverTimeIndicatorProps): React.JSX.Element {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top: y }}
    >
      <span className="bg-blurple text-blurple-foreground text-caption shadow-card -translate-x-2 rounded-sm px-1.5 py-0.5 font-medium tabular-nums">
        {label}
      </span>
      <span className="bg-blurple/70 h-px flex-1" />
    </div>
  );
}
