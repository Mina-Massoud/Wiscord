interface StatTileProps {
  label: string;
  value: number;
  suffix: string;
  icon?: React.ReactNode;
}

export function StatTile({ label, value, suffix, icon }: StatTileProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-md bg-white/[0.04] px-3 py-2">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-ink-muted text-badge font-semibold tracking-wider uppercase">
          {label}
        </span>
      </div>
      <p className="text-ink text-tab leading-none font-bold tabular-nums">
        {value}
        <span className="text-ink-muted ml-1 text-[10px] font-medium">{suffix}</span>
      </p>
    </div>
  );
}
