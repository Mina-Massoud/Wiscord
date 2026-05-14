import { Schema, model, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * A category groups calendar events by domain (Class, Exam, Study session, …)
 * and supplies the color stripe rendered on every event tile. Two scopes:
 *
 * - `scope: 'user'`, `ownerId === userId` → personal categories. Built-ins are
 *   seeded idempotently the first time a user hits `GET /calendar/categories`.
 * - `scope: 'channel'`, `ownerId === channelId` → channel-shared categories.
 *
 * `builtinSlug` is non-null for the six seeded study-domain defaults so the
 * seed upsert is idempotent and so the UI can render the default name in the
 * user's locale later without rewriting the row.
 */

export type CalendarCategoryScope = 'user' | 'channel';

export const CALENDAR_CATEGORY_COLOR_SLUGS = [
  'blurple',
  'destructive',
  'success',
  'warning',
  'violet',
  'teal',
  'pink',
  'amber',
] as const;
export type CalendarCategoryColor = (typeof CALENDAR_CATEGORY_COLOR_SLUGS)[number];

export const CALENDAR_BUILTIN_SLUGS = [
  'class',
  'exam',
  'study',
  'assignment',
  'project',
  'break',
] as const;
export type CalendarBuiltinSlug = (typeof CALENDAR_BUILTIN_SLUGS)[number];

const calendarCategorySchema = new Schema(
  {
    scope: { type: String, enum: ['user', 'channel'], required: true },
    ownerId: { type: String, required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    color: {
      type: String,
      enum: CALENDAR_CATEGORY_COLOR_SLUGS,
      required: true,
    },
    builtinSlug: {
      type: String,
      enum: [...CALENDAR_BUILTIN_SLUGS, null],
      default: null,
    },
  },
  { timestamps: true, collection: 'calendar_categories' },
);

// Idempotent seeding key for built-ins. Allows multiple non-builtin rows per
// owner (sparse partial index on builtinSlug only).
calendarCategorySchema.index(
  { scope: 1, ownerId: 1, builtinSlug: 1 },
  {
    unique: true,
    partialFilterExpression: { builtinSlug: { $type: 'string' } },
  },
);
calendarCategorySchema.index({ scope: 1, ownerId: 1, createdAt: 1 });

applySerialize(calendarCategorySchema);

export type CalendarCategoryRow = InferSchemaType<typeof calendarCategorySchema>;
export const CalendarCategory = model('CalendarCategory', calendarCategorySchema);
export type CalendarCategoryDoc = InstanceType<typeof CalendarCategory>;
