import { cn } from '@/lib/cn';
import { COLOR_PRESETS } from './Eventformschema';

interface EventColorPickerProps {
    value: string;
    onChange: (color: string) => void;
}

export function EventColorPicker({ value, onChange }: EventColorPickerProps): React.JSX.Element {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
                Theme Color
            </span>
            <div className="flex items-center gap-3">
                <div
                    className="h-6 w-12 rounded-md border border-glass-border transition-all duration-base"
                    style={{ backgroundColor: value }}
                />
                <div className="flex gap-2">
                    {COLOR_PRESETS.map((preset) => (
                        <button
                            key={preset.value}
                            type="button"
                            className={cn(
                                'size-6 rounded-full border border-glass-border hover:scale-110 active:scale-95 transition-all',
                                value === preset.value && 'ring-offset-background ring-2 ring-blurple',
                            )}
                            style={{ backgroundColor: preset.value }}
                            onClick={() => onChange(preset.value)}
                            title={preset.name}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}