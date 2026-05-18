interface SensitivitySliderProps {
  value: number;
  onChange: (v: number) => void;
}

export function SensitivitySlider({ value, onChange }: SensitivitySliderProps): React.JSX.Element {
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between">
        <h4 className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
          Input Sensitivity
        </h4>
        <span className="text-ink-subtle text-caption tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Input sensitivity"
        className="bg-glass-surface-2 accent-blurple mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full"
      />
      <p className="text-ink-subtle text-caption mt-2">
        Lower opens the mic more easily; higher needs you to be louder.
      </p>
    </div>
  );
}
