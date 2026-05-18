import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CalendarTimeFieldProps {
  /** `HH:MM` in 24-hour format (the wire format the composer schema uses). */
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));

/**
 * shadcn Popover-driven time picker built from three Selects (hour, minute,
 * period). Replaces the native `<input type="time">` so the UI sits inside
 * the project's glass-token system instead of the OS theme.
 *
 * Wire format is 24-hour `HH:MM`; the picker UI is 12-hour with AM/PM.
 */
export function CalendarTimeField({
  value,
  onChange,
  ariaLabel = 'Pick a time',
}: CalendarTimeFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const parts = useMemo(() => parseValue(value), [value]);
  const [minuteInput, setMinuteInput] = useState(parts.minute);

  useEffect(() => {
    setMinuteInput(parts.minute);
  }, [parts.minute]);

  const setPart = (next: Partial<typeof parts>): void => {
    const merged = { ...parts, ...next };
    onChange(formatValue(merged));
  };

  const handleMinuteChange = (raw: string): void => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setMinuteInput(digits);
    if (digits.length === 0) return;
    const n = Number(digits);
    if (n >= 0 && n <= 59) {
      setPart({ minute: digits.padStart(2, '0') });
    }
  };

  const handleMinuteBlur = (): void => {
    const n = Math.max(0, Math.min(59, Number(minuteInput) || 0));
    const padded = String(n).padStart(2, '0');
    setMinuteInput(padded);
    setPart({ minute: padded });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          // bg-background + border-input match the shadcn SelectTrigger
          // so this trigger reads as a sibling of the Category select
          // when they sit next to each other in the quick-add popover.
          className="bg-background border-input text-ink hover:bg-glass-hover w-full justify-start gap-2 font-normal"
        >
          <Clock className="text-ink-muted size-4" aria-hidden />
          <span className="text-control tabular-nums">{format12(parts)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="bg-surface-2 border-glass-border w-auto p-3 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <Select value={parts.hour12} onValueChange={(v) => setPart({ hour12: v })}>
            <SelectTrigger className="w-20 tabular-nums" aria-label="Hour">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS_12.map((h) => (
                <SelectItem key={h} value={h} className="tabular-nums">
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-ink-muted">:</span>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={minuteInput}
            onChange={(e) => handleMinuteChange(e.target.value)}
            onBlur={handleMinuteBlur}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Minute"
            className="w-16 text-center tabular-nums"
          />
          <Select value={parts.period} onValueChange={(v) => setPart({ period: v as 'AM' | 'PM' })}>
            <SelectTrigger className="w-20" aria-label="AM or PM">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface TimeParts {
  hour12: string;
  minute: string;
  period: 'AM' | 'PM';
}

function parseValue(value: string): TimeParts {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return { hour12: '9', minute: '00', period: 'AM' };
  const h24 = Math.max(0, Math.min(23, Number(m[1])));
  const min = Math.max(0, Math.min(59, Number(m[2])));
  const period: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12: String(h12), minute: String(min).padStart(2, '0'), period };
}

function formatValue(parts: TimeParts): string {
  const h12 = Number(parts.hour12);
  const h24 = parts.period === 'AM' ? h12 % 12 : (h12 % 12) + 12;
  return `${String(h24).padStart(2, '0')}:${parts.minute}`;
}

function format12(parts: TimeParts): string {
  return `${parts.hour12}:${parts.minute} ${parts.period}`;
}
