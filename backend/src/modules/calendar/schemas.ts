import { z } from 'zod';

import {
  CALENDAR_CATEGORY_COLOR_SLUGS,
  CALENDAR_BUILTIN_SLUGS,
} from '../../db/models/CalendarCategory.js';

const isoDate = z
  .string()
  .datetime({ offset: true, message: 'must be an ISO 8601 datetime' });

const objectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'must be a 24-char hex ObjectId');

const channelIdNullable = z.union([
  z.string().uuid('channelId must be a UUID'),
  z.null(),
]);

// ── Params ────────────────────────────────────────────────────────────────

export const eventIdParam = z.object({ id: objectIdString });
export type EventIdParam = z.infer<typeof eventIdParam>;

export const categoryIdParam = z.object({ id: objectIdString });
export type CategoryIdParam = z.infer<typeof categoryIdParam>;

// ── Range query ────────────────────────────────────────────────────────────

export const eventRangeQuery = z
  .object({
    from: isoDate,
    to: isoDate,
    channelId: z.string().uuid('channelId must be a UUID').optional(),
  })
  .refine((q) => new Date(q.from) < new Date(q.to), {
    message: '`from` must be earlier than `to`',
    path: ['to'],
  });
export type EventRangeQuery = z.infer<typeof eventRangeQuery>;

export const mineRangeQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine((q) => new Date(q.from) < new Date(q.to), {
    message: '`from` must be earlier than `to`',
    path: ['to'],
  });
export type MineRangeQuery = z.infer<typeof mineRangeQuery>;

export const categoryListQuery = z.object({
  scope: z.enum(['user', 'channel']),
  channelId: z.string().uuid('channelId must be a UUID').optional(),
});
export type CategoryListQuery = z.infer<typeof categoryListQuery>;

// ── Bodies — events ────────────────────────────────────────────────────────

const recurrenceBody = z.object({
  freq: z.enum(['none', 'weekly_n']),
  count: z.number().int().min(1).max(52),
});

export const createEventBody = z
  .object({
    channelId: channelIdNullable.default(null),
    categoryId: objectIdString,
    title: z.string().trim().min(1).max(200),
    description: z.string().max(4000).default(''),
    startAt: isoDate,
    endAt: isoDate,
    allDay: z.boolean().default(false),
    recurrence: recurrenceBody.default({ freq: 'none', count: 1 }),
  })
  .refine((b) => new Date(b.startAt) < new Date(b.endAt), {
    message: '`startAt` must be earlier than `endAt`',
    path: ['endAt'],
  });
export type CreateEventBody = z.infer<typeof createEventBody>;

// PATCH: every field optional, but if both start+end land they must be ordered.
export const updateEventBody = z
  .object({
    categoryId: objectIdString.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(4000).optional(),
    startAt: isoDate.optional(),
    endAt: isoDate.optional(),
    allDay: z.boolean().optional(),
    recurrence: recurrenceBody.optional(),
  })
  .refine(
    (b) => {
      if (b.startAt && b.endAt) return new Date(b.startAt) < new Date(b.endAt);
      return true;
    },
    { message: '`startAt` must be earlier than `endAt`', path: ['endAt'] },
  );
export type UpdateEventBody = z.infer<typeof updateEventBody>;

// ── Bodies — categories ────────────────────────────────────────────────────

const colorEnum = z.enum(CALENDAR_CATEGORY_COLOR_SLUGS);

export const createCategoryBody = z.object({
  scope: z.enum(['user', 'channel']),
  channelId: z.string().uuid('channelId must be a UUID').optional(),
  name: z.string().trim().min(1).max(60),
  color: colorEnum,
});
export type CreateCategoryBody = z.infer<typeof createCategoryBody>;

export const updateCategoryBody = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    color: colorEnum.optional(),
  })
  .refine((b) => b.name !== undefined || b.color !== undefined, {
    message: 'at least one of `name` or `color` is required',
  });
export type UpdateCategoryBody = z.infer<typeof updateCategoryBody>;

// Re-export builtin slug list for tests / clients.
export { CALENDAR_BUILTIN_SLUGS };
