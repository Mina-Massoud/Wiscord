import { Schema, model, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * A single calendar event. Two-axis ownership:
 *
 * - `userId` is always the author (the person who created it).
 * - `channelId === null` → personal event, visible only to `userId`.
 * - `channelId !== null` → channel-shared event, visible to all members of
 *   that channel. The author still owns edit rights for v1; once a real
 *   channel-admin role lands, admins inherit edit rights too.
 *
 * Dates are stored UTC. Range queries pull `{startAt: {$lt: rangeEnd}, endAt:
 * {$gt: rangeStart}}` so an event that starts before and ends inside the
 * window still surfaces.
 *
 * Recurrence is intentionally narrow for v1 — `weekly_n` repeats the event on
 * the same weekday for `count` weeks. Full RRULE is deferred until we have a
 * real demand for it.
 */

export type CalendarRecurrenceFreq = 'none' | 'weekly_n';

export interface CalendarRecurrence {
  freq: CalendarRecurrenceFreq;
  /** Number of occurrences for `weekly_n`. 1..52. Ignored when freq === 'none'. */
  count: number;
}

const recurrenceSchema = new Schema(
  {
    freq: { type: String, enum: ['none', 'weekly_n'], required: true, default: 'none' },
    count: { type: Number, required: true, default: 1, min: 1, max: 52 },
  },
  { _id: false },
);

const calendarEventSchema = new Schema(
  {
    userId: { type: String, required: true },
    channelId: { type: String, default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: 'CalendarCategory', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, default: '', maxlength: 4000 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    allDay: { type: Boolean, required: true, default: false },
    recurrence: { type: recurrenceSchema, default: () => ({ freq: 'none', count: 1 }) },
  },
  { timestamps: true, collection: 'calendar_events' },
);

// Range scans for the personal view (userId + time window).
calendarEventSchema.index({ userId: 1, startAt: 1 });
// Range scans for a channel view.
calendarEventSchema.index({ channelId: 1, startAt: 1 });
// Category filter / cascade-delete lookups.
calendarEventSchema.index({ categoryId: 1 });

applySerialize(calendarEventSchema);

export type CalendarEventRow = InferSchemaType<typeof calendarEventSchema>;
export const CalendarEvent = model('CalendarEvent', calendarEventSchema);
export type CalendarEventDoc = InstanceType<typeof CalendarEvent>;
