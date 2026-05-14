/**
 * Generic "group items by how recently they were edited" helper.
 * Anchored to the caller's local "now" (defaults to `new Date()`) so
 * the bucket boundaries shift correctly across midnight without
 * needing a stored field.
 *
 * Buckets returned in fixed order: Today → Yesterday → This week →
 * Older. Empty buckets are dropped from the output so consumers never
 * have to render a blank section.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecencyGroup<T> {
  label: 'Today' | 'Yesterday' | 'This week' | 'Older';
  items: T[];
}

export function groupByRecency<T>(
  items: readonly T[],
  getUpdatedAt: (item: T) => string,
  anchor: Date = new Date(),
): RecencyGroup<T>[] {
  const startOfToday = new Date(anchor);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday.getTime() - DAY_MS);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * DAY_MS);

  const today: T[] = [];
  const yesterday: T[] = [];
  const thisWeek: T[] = [];
  const older: T[] = [];

  const sorted = [...items].sort((a, b) => (getUpdatedAt(a) < getUpdatedAt(b) ? 1 : -1));

  for (const item of sorted) {
    const updated = new Date(getUpdatedAt(item));
    if (Number.isNaN(updated.getTime())) {
      older.push(item);
      continue;
    }
    if (updated >= startOfToday) today.push(item);
    else if (updated >= startOfYesterday) yesterday.push(item);
    else if (updated >= startOfWeek) thisWeek.push(item);
    else older.push(item);
  }

  const groups: RecencyGroup<T>[] = [];
  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (thisWeek.length) groups.push({ label: 'This week', items: thisWeek });
  if (older.length) groups.push({ label: 'Older', items: older });

  return groups;
}
