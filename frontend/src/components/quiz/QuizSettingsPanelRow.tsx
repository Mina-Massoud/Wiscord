interface RowProps {
  label: string;
  helper: string;
  children: React.ReactNode;
}

export function Row({ label, helper, children }: RowProps): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ink text-control font-medium">{label}</span>
        <span className="text-ink-muted text-caption">{helper}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
