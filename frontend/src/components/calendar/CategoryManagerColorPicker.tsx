import { CALENDAR_CATEGORY_COLORS, type CalendarCategoryColor } from '@/types/calendar';
import { cn } from '@/lib/cn';
import { CATEGORY_FILL_BG } from './category-color';

export function ColorPicker({
  value,
  onChange,
}: {
  value: CalendarCategoryColor;
  onChange: (next: CalendarCategoryColor) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Category color">
      {CALENDAR_CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          role="radio"
          aria-checked={value === c}
          className={cn(
            'rounded-pill duration-fast ease-wiscord size-5 border transition-transform',
            CATEGORY_FILL_BG[c],
            value === c ? 'border-ink scale-110' : 'border-transparent hover:scale-105',
          )}
        />
      ))}
    </div>
  );
}
