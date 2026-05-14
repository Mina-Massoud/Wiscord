/**
 * Wire types for the calendar module. Mirrors the DTO shapes returned by
 * `backend/src/modules/calendar/`. Keep in sync with `event-service.ts`
 * and `category-service.ts`.
 */

export type CalendarCategoryColor =
  | 'blurple'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'violet'
  | 'teal'
  | 'pink'
  | 'amber';

export const CALENDAR_CATEGORY_COLORS: readonly CalendarCategoryColor[] = [
  'blurple',
  'destructive',
  'success',
  'warning',
  'violet',
  'teal',
  'pink',
  'amber',
];

export type CalendarCategoryScope = 'user' | 'channel';

export type CalendarBuiltinSlug = 'class' | 'exam' | 'study' | 'assignment' | 'project' | 'break';

export interface CalendarCategory {
  id: string;
  scope: CalendarCategoryScope;
  ownerId: string;
  name: string;
  color: CalendarCategoryColor;
  builtinSlug: CalendarBuiltinSlug | null;
  createdAt: string;
  updatedAt: string;
}

export type CalendarRecurrenceFreq = 'none' | 'weekly_n';

export interface CalendarRecurrence {
  freq: CalendarRecurrenceFreq;
  count: number;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  channelId: string | null;
  categoryId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  recurrence: CalendarRecurrence;
  occurrenceId: string;
  isOccurrence: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

export interface CalendarEventsResponse {
  events: CalendarEvent[];
}

export interface CalendarEventResponse {
  event: CalendarEvent;
}

export interface CalendarCategoriesResponse {
  categories: CalendarCategory[];
}

export interface CalendarCategoryResponse {
  category: CalendarCategory;
}

export interface CreateEventInput {
  channelId: string | null;
  categoryId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  recurrence?: CalendarRecurrence;
}

export interface UpdateEventInput {
  categoryId?: string;
  title?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  recurrence?: CalendarRecurrence;
}

export interface CreateCategoryInput {
  scope: CalendarCategoryScope;
  channelId?: string;
  name: string;
  color: CalendarCategoryColor;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: CalendarCategoryColor;
}
