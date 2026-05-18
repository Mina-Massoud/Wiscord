interface StatCardProps {
  label: string;
  value: React.ReactNode;
  ariaValue: string;
  detail: string;
}

export function StatCard({ label, value, ariaValue, detail }: StatCardProps): React.JSX.Element {
  return (
    <div
      role="listitem"
      className="bg-glass-surface-1 border-glass-border flex flex-col gap-1 rounded-lg border p-4"
    >
      <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span
        className="text-ink text-display text-3xl leading-none font-bold tabular-nums"
        aria-label={ariaValue}
      >
        {value}
      </span>
      <span className="text-ink-muted text-caption">{detail}</span>
    </div>
  );
}
