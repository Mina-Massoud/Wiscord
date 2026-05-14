import type {
  CalendarBuiltinSlug,
  CalendarCategoryColor,
} from '../../db/models/CalendarCategory.js';

/**
 * The six study-domain default categories. Seeded idempotently the first
 * time a user (or channel) lists categories. Users can rename and recolor
 * but cannot delete a built-in row — removing a category orphans any event
 * pointing at it.
 *
 * The order here is the order rendered in the picker.
 */
export interface CalendarBuiltinCategory {
  slug: CalendarBuiltinSlug;
  name: string;
  color: CalendarCategoryColor;
}

export const CALENDAR_BUILTIN_CATEGORIES: readonly CalendarBuiltinCategory[] = [
  { slug: 'class', name: 'Class', color: 'blurple' },
  { slug: 'exam', name: 'Exam', color: 'destructive' },
  { slug: 'study', name: 'Study session', color: 'success' },
  { slug: 'assignment', name: 'Assignment', color: 'warning' },
  { slug: 'project', name: 'Project', color: 'violet' },
  { slug: 'break', name: 'Break', color: 'teal' },
];
