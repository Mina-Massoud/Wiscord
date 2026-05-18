import { useMemo, useState } from 'react';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import {
  addDays,
  addMonths,
  isSameDay,
  isSameMonth,
  monthTitle,
  startOfMonthGrid,
  weekdayShortLabels,
} from '@/lib/calendar-date';

interface CalendarDateFieldProps {
  /** `YYYY-MM-DD` (local) — same wire format the composer schema uses. */
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
}

/**
 * shadcn Popover-driven date picker. Replaces the browser-native
 * `<input type="date">` (which renders a stark white OS-themed dialog
 * that ignores the app's design tokens) with a glass-token month grid
 * built on the same date helpers as the rest of the calendar feature.
 */
export function CalendarDateField({
  value,
  onChange,
  ariaLabel = 'Pick a date',
}: CalendarDateFieldProps): React.JSX.Element {
  const selectedDate = useMemo(() => parseLocal(value) ?? new Date(), [value]);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => selectedDate);

  const weekdays = useMemo(() => weekdayShortLabels(), []);
  const days = useMemo(() => {
    const first = startOfMonthGrid(viewMonth);
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [viewMonth]);

  const handleSelect = (d: Date): void => {
    onChange(toLocalIso(d));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className="bg-background border-input text-ink hover:bg-glass-hover w-full justify-start gap-2 font-normal"
        >
          <CalendarIcon className="text-ink-muted size-4" aria-hidden />
          <span className="text-control tabular-nums">{formatTrigger(selectedDate)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="bg-surface-2 border-glass-border w-72 space-y-3 p-3 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-control text-ink font-medium">{monthTitle(viewMonth)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="text-caption text-ink-subtle grid grid-cols-7 gap-1 text-center">
          {weekdays.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const inMonth = isSameMonth(d, viewMonth);
            const selected = isSameDay(d, selectedDate);
            const isToday = isSameDay(d, new Date());
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => handleSelect(d)}
                className={cn(
                  'text-caption flex size-8 items-center justify-center rounded-md tabular-nums',
                  'duration-fast ease-wiscord transition-colors',
                  'focus-visible:ring-blurple/60 focus-visible:ring-2 focus-visible:outline-none',
                  selected
                    ? 'bg-blurple text-blurple-foreground font-semibold'
                    : isToday
                      ? 'text-ink hover:bg-glass-hover ring-blurple/40 ring-1 ring-inset'
                      : 'text-ink hover:bg-glass-hover',
                  !inMonth && 'opacity-40',
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const t = new Date();
              setViewMonth(t);
              handleSelect(t);
            }}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTrigger(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}
