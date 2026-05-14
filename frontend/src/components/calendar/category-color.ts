import type { CalendarCategoryColor } from '@/types/calendar';

/**
 * Static lookup of every supported category color → Tailwind class.
 * Static (rather than `bg-calendar-${color}`) so Tailwind's content scanner
 * picks every class up at build time and PurgeCSS doesn't drop them.
 *
 * `fill` is the strong color stripe + chip background.
 * `tint` is a translucent fill used behind tile bodies in week / day views.
 * `text` is the corresponding foreground when the swatch becomes the bg.
 */
export const CATEGORY_FILL_BG: Record<CalendarCategoryColor, string> = {
  blurple: 'bg-calendar-blurple',
  destructive: 'bg-calendar-destructive',
  success: 'bg-calendar-success',
  warning: 'bg-calendar-warning',
  violet: 'bg-calendar-violet',
  teal: 'bg-calendar-teal',
  pink: 'bg-calendar-pink',
  amber: 'bg-calendar-amber',
};

export const CATEGORY_TEXT: Record<CalendarCategoryColor, string> = {
  blurple: 'text-calendar-blurple',
  destructive: 'text-calendar-destructive',
  success: 'text-calendar-success',
  warning: 'text-calendar-warning',
  violet: 'text-calendar-violet',
  teal: 'text-calendar-teal',
  pink: 'text-calendar-pink',
  amber: 'text-calendar-amber',
};

export const CATEGORY_BORDER: Record<CalendarCategoryColor, string> = {
  blurple: 'border-calendar-blurple',
  destructive: 'border-calendar-destructive',
  success: 'border-calendar-success',
  warning: 'border-calendar-warning',
  violet: 'border-calendar-violet',
  teal: 'border-calendar-teal',
  pink: 'border-calendar-pink',
  amber: 'border-calendar-amber',
};
