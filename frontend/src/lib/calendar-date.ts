/**
 * Calendar date math. Always operates on real Date objects in the viewer's
 * local time zone — the wire format is UTC ISO strings, and conversion to
 * local happens at the rendering boundary inside these helpers.
 *
 * Week starts Monday (ISO 8601 / European convention; the reference site
 * follows the same convention).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

export function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  const day = out.getDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  out.setDate(out.getDate() + diff);
  return out;
}

export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * The first day rendered by the month grid — Monday on or before the first
 * of the month. The grid always spans six weeks so view height stays stable.
 */
export function startOfMonthGrid(d: Date): Date {
  return startOfWeek(startOfMonth(d));
}

export function endOfMonthGrid(d: Date): Date {
  const start = startOfMonthGrid(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 42);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate(), d.getHours(), d.getMinutes());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

/**
 * `Mon`, `Tue` … for the weekday header row.
 */
export function weekdayShortLabels(locale = 'en-US'): string[] {
  // Pick a known Monday and roll forward seven days.
  const monday = new Date(2026, 0, 5); // 2026-01-05 is a Monday
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(addDays(monday, i)));
}

/**
 * "May 2026" — the header label for the month view.
 */
export function monthTitle(d: Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
}

/**
 * "Mon, May 14" — the day-cell sublabel.
 */
export function dayLabel(d: Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * "9:30 AM" — short event time.
 */
export function timeLabel(d: Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
}
