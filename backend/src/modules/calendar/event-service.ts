import { Types } from 'mongoose';

import {
  CalendarEvent,
  type CalendarEventDoc,
  type CalendarRecurrence,
} from '../../db/models/index.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { resolveCategoryForEvent } from './category-service.js';
import { emitCalendarChange } from './realtime-bridge.js';

/**
 * Service for calendar events. Authz rules:
 *
 * - Personal events (`channelId === null`): only `userId` reads or writes.
 * - Channel events: any authed caller reads or creates inside a channel they
 *   belong to (membership check is a TODO once channels lands; for v1 we
 *   trust the channel-scoped routes). Edits and deletes are creator-only.
 *
 * Range queries return single occurrences for non-recurring events and
 * expanded copies for `weekly_n` recurrences. Each expanded copy carries a
 * stable `occurrenceId` so the client can drag a single occurrence without
 * rewriting the master row's startAt — but for v1 we ship master edits only
 * and treat the expansion as read-only.
 */

const RANGE_HARD_CAP = 200;

export interface CalendarEventDTO {
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
  /** Stable id for a single occurrence inside a recurring series. */
  occurrenceId: string;
  /** `true` when this DTO is an expansion (not the master row). */
  isOccurrence: boolean;
  createdAt: string;
  updatedAt: string;
}

function masterToDTO(doc: CalendarEventDoc): CalendarEventDTO {
  return {
    id: String(doc._id),
    userId: doc.userId,
    channelId: doc.channelId ?? null,
    categoryId: String(doc.categoryId),
    title: doc.title,
    description: doc.description,
    startAt: doc.startAt.toISOString(),
    endAt: doc.endAt.toISOString(),
    allDay: doc.allDay,
    recurrence: doc.recurrence,
    occurrenceId: String(doc._id),
    isOccurrence: false,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function expandOccurrences(
  doc: CalendarEventDoc,
  windowStart: Date,
  windowEnd: Date,
): CalendarEventDTO[] {
  const master = masterToDTO(doc);
  if (doc.recurrence.freq === 'none') {
    return [master];
  }

  // weekly_n: same weekday, count repeats starting at the master's startAt.
  const out: CalendarEventDTO[] = [];
  const durationMs = doc.endAt.getTime() - doc.startAt.getTime();
  for (let i = 0; i < doc.recurrence.count; i++) {
    const start = new Date(doc.startAt.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + durationMs);
    if (end <= windowStart || start >= windowEnd) continue;
    out.push({
      ...master,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      occurrenceId: `${master.id}:${i}`,
      isOccurrence: i > 0,
    });
  }
  return out;
}

export async function listEventsInRange(args: {
  userId: string;
  channelId?: string;
  from: Date;
  to: Date;
}): Promise<CalendarEventDTO[]> {
  const filter = args.channelId
    ? { channelId: args.channelId }
    : { userId: args.userId, channelId: null };

  // Pull rows whose master window overlaps; expansion happens in-process.
  // For weekly_n with count<=52, the master can start up to 52 weeks before
  // the window — we widen the lower bound accordingly so we don't miss
  // recurrences that begin earlier than the window.
  const lowerBound = new Date(args.from.getTime() - 52 * 7 * 24 * 60 * 60 * 1000);
  const rows = await CalendarEvent.find({
    ...filter,
    startAt: { $gte: lowerBound, $lt: args.to },
    endAt: { $gt: args.from },
  })
    .sort({ startAt: 1 })
    .limit(RANGE_HARD_CAP);

  return rows.flatMap((row) => expandOccurrences(row, args.from, args.to));
}

export async function createEvent(args: {
  userId: string;
  body: {
    channelId: string | null;
    categoryId: string;
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    allDay: boolean;
    recurrence: CalendarRecurrence;
  };
}): Promise<CalendarEventDTO> {
  const scope = args.body.channelId ? 'channel' : 'user';
  const ownerId = args.body.channelId ?? args.userId;
  await resolveCategoryForEvent({
    categoryId: args.body.categoryId,
    scope,
    ownerId,
  });

  const doc = await CalendarEvent.create({
    userId: args.userId,
    channelId: args.body.channelId,
    categoryId: new Types.ObjectId(args.body.categoryId),
    title: args.body.title,
    description: args.body.description,
    startAt: new Date(args.body.startAt),
    endAt: new Date(args.body.endAt),
    allDay: args.body.allDay,
    recurrence: args.body.recurrence,
  });
  emitCalendarChange({
    kind: 'created',
    userId: args.userId,
    channelId: args.body.channelId,
    eventId: String(doc._id),
  });
  return masterToDTO(doc);
}

export async function updateEvent(args: {
  userId: string;
  eventId: string;
  patch: {
    categoryId?: string;
    title?: string;
    description?: string;
    startAt?: string;
    endAt?: string;
    allDay?: boolean;
    recurrence?: CalendarRecurrence;
  };
}): Promise<CalendarEventDTO> {
  const doc = await CalendarEvent.findById(args.eventId);
  if (!doc) throw notFound('event');
  if (doc.userId !== args.userId) throw forbidden();

  if (args.patch.categoryId !== undefined) {
    const scope = doc.channelId ? 'channel' : 'user';
    const ownerId = doc.channelId ?? doc.userId;
    await resolveCategoryForEvent({ categoryId: args.patch.categoryId, scope, ownerId });
    doc.categoryId = new Types.ObjectId(args.patch.categoryId);
  }
  if (args.patch.title !== undefined) doc.title = args.patch.title;
  if (args.patch.description !== undefined) doc.description = args.patch.description;
  if (args.patch.startAt !== undefined) doc.startAt = new Date(args.patch.startAt);
  if (args.patch.endAt !== undefined) doc.endAt = new Date(args.patch.endAt);
  if (args.patch.allDay !== undefined) doc.allDay = args.patch.allDay;
  if (args.patch.recurrence !== undefined) doc.recurrence = args.patch.recurrence;

  // Re-check ordering after partial patch (one side may have moved).
  if (doc.startAt >= doc.endAt) {
    const { badRequest } = await import('../../lib/errors.js');
    throw badRequest('invalid_range', '`startAt` must be earlier than `endAt`');
  }

  await doc.save();
  emitCalendarChange({
    kind: 'updated',
    userId: doc.userId,
    channelId: doc.channelId ?? null,
    eventId: String(doc._id),
  });
  return masterToDTO(doc);
}

export async function deleteEvent(args: {
  userId: string;
  eventId: string;
}): Promise<{ deleted: true }> {
  const doc = await CalendarEvent.findById(args.eventId);
  if (!doc) throw notFound('event');
  if (doc.userId !== args.userId) throw forbidden();
  await doc.deleteOne();
  emitCalendarChange({
    kind: 'deleted',
    userId: doc.userId,
    channelId: doc.channelId ?? null,
    eventId: String(doc._id),
  });
  return { deleted: true };
}
