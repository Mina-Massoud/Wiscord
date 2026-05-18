interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

export function VolumeSlider({ label, value, onChange }: VolumeSliderProps): React.JSX.Element {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h4 className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
          {label}
        </h4>
        <span className="text-ink-subtle text-caption tabular-nums">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="bg-glass-surface-2 accent-blurple mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full"
      />
    </div>
  );
}
