import { EventEmitter } from 'node:events';
import { Types } from 'mongoose';
import {
  EventRsvp,
  ServerEvent,
  ServerMember,
  User,
  type ServerEventDoc,
} from '../../db/models/index.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type {
  CreateEventBody,
  CreatorDto,
  EventWithMetaDto,
  UpdateEventBody,
} from './schemas.js';

// ─── Realtime event bus ──────────────────────────────────────────────────────

export interface ServerEventCreatedEvent {
  serverId: string;
  event: EventWithMetaDto;
}

export interface ServerEventUpdatedEvent {
  serverId: string;
  eventId: string;
  event: EventWithMetaDto;
}

export interface ServerEventDeletedEvent {
  serverId: string;
  eventId: string;
}

export interface ServerEventRsvpChangedEvent {
  serverId: string;
  eventId: string;
  goingCount: number;
  interestedCount: number;
}

class ServerEventEmitter extends EventEmitter {
  emitCreated(payload: ServerEventCreatedEvent): void {
    this.emit('created', payload);
  }
  emitUpdated(payload: ServerEventUpdatedEvent): void {
    this.emit('updated', payload);
  }
  emitDeleted(payload: ServerEventDeletedEvent): void {
    this.emit('deleted', payload);
  }
  emitRsvpChanged(payload: ServerEventRsvpChangedEvent): void {
    this.emit('rsvp_changed', payload);
  }
}

export const serverEventBus = new ServerEventEmitter();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertServerMember(userId: string, serverId: string): Promise<void> {
  const membership = await ServerMember.findOne({ serverId, userId }).lean();
  if (!membership) {
    throw notFound('server');
  }
}

async function assertEventEditor(userId: string, doc: ServerEventDoc): Promise<void> {
  const serverId = doc.serverId.toString();
  // Check server membership first
  const membership = await ServerMember.findOne({ serverId, userId }).lean();
  if (!membership) throw notFound('server');
  // Creator or server owner may edit/delete
  if (doc.creatorId.toString() !== userId && membership.role !== 'owner') {
    throw forbidden('Only the event creator or server owner can modify this event.');
  }
}

async function getRsvpCounts(
  eventId: string,
): Promise<{ goingCount: number; interestedCount: number }> {
  const [goingCount, interestedCount] = await Promise.all([
    EventRsvp.countDocuments({ eventId, status: 'going' }),
    EventRsvp.countDocuments({ eventId, status: 'interested' }),
  ]);
  return { goingCount, interestedCount };
}

async function toEventWithMeta(
  doc: ServerEventDoc,
  userId: string,
): Promise<EventWithMetaDto> {
  const eventId = doc._id.toString();

  const [counts, myRsvpDoc, creatorUser] = await Promise.all([
    getRsvpCounts(eventId),
    EventRsvp.findOne({ eventId, userId }).lean(),
    User.findById(doc.creatorId).lean(),
  ]);

  const creator: CreatorDto = creatorUser
    ? {
        id: creatorUser._id.toString(),
        displayName: creatorUser.displayName ?? creatorUser.username ?? 'Unknown',
        avatarUrl: creatorUser.avatarUrl ?? null,
      }
    : { id: doc.creatorId.toString(), displayName: 'Unknown', avatarUrl: null };

  return {
    id: eventId,
    serverId: doc.serverId.toString(),
    creatorId: doc.creatorId.toString(),
    title: doc.title,
    description: doc.description ?? null,
    type: doc.type,
    channelId: doc.channelId ? doc.channelId.toString() : null,
    externalLink: doc.externalLink ?? null,
    startsAt: (doc.startsAt as Date).toISOString(),
    endsAt: doc.endsAt ? (doc.endsAt as Date).toISOString() : null,
    coverColor: doc.coverColor ?? null,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    goingCount: counts.goingCount,
    interestedCount: counts.interestedCount,
    myRsvp: myRsvpDoc ? myRsvpDoc.status : null,
    creator,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns all events for a server, sorted ascending by startsAt.
 * Caller must be a server member.
 */
export async function listServerEvents(
  userId: string,
  serverId: string,
): Promise<EventWithMetaDto[]> {
  await assertServerMember(userId, serverId);
  const docs = await ServerEvent.find({ serverId }).sort({ startsAt: 1 }).exec();
  return Promise.all(docs.map((doc) => toEventWithMeta(doc, userId)));
}

/**
 * Returns a single event with full meta.
 * Caller must be a member of the event's server.
 */
export async function getEvent(userId: string, eventId: string): Promise<EventWithMetaDto> {
  const doc = await ServerEvent.findById(eventId).exec();
  if (!doc) throw notFound('event');
  await assertServerMember(userId, doc.serverId.toString());
  return toEventWithMeta(doc, userId);
}

/**
 * Creates a new event. Any server member can create.
 * Emits realtime `created` notification.
 */
export async function createEvent(
  userId: string,
  serverId: string,
  body: CreateEventBody,
): Promise<EventWithMetaDto> {
  await assertServerMember(userId, serverId);

  const doc = await ServerEvent.create({
    serverId,
    creatorId: userId,
    title: body.title,
    description: body.description ?? null,
    type: body.type,
    channelId: body.channelId ?? null,
    externalLink: body.externalLink ?? null,
    startsAt: new Date(body.startsAt),
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    coverColor: body.coverColor ?? null,
    status: 'scheduled',
  });

  const eventDto = await toEventWithMeta(doc, userId);
  serverEventBus.emitCreated({ serverId, event: eventDto });
  return eventDto;
}

/**
 * Updates an existing event. Only the creator or server owner may edit.
 * Emits realtime `updated` notification.
 */
export async function updateEvent(
  userId: string,
  eventId: string,
  body: UpdateEventBody,
): Promise<EventWithMetaDto> {
  const doc = await ServerEvent.findById(eventId).exec();
  if (!doc) throw notFound('event');
  await assertEventEditor(userId, doc);

  // Validate endsAt > startsAt after potential update
  const startsAt = body.startsAt ? new Date(body.startsAt) : (doc.startsAt as Date);
  const endsAt = body.endsAt ? new Date(body.endsAt) : body.endsAt === null ? null : (doc.endsAt as Date | null);
  if (endsAt && endsAt <= startsAt) {
    throw badRequest('invalid_dates', 'endsAt must be after startsAt.');
  }

  if (body.title !== undefined) doc.title = body.title;
  if (body.description !== undefined) doc.description = body.description ?? null;
  if (body.type !== undefined) doc.type = body.type;
  if (body.channelId !== undefined) {
    doc.channelId = body.channelId ? new Types.ObjectId(body.channelId) : null;
  }
  if (body.externalLink !== undefined) doc.externalLink = body.externalLink ?? null;
  if (body.startsAt !== undefined) doc.startsAt = startsAt;
  if ('endsAt' in body) doc.endsAt = endsAt;
  if (body.coverColor !== undefined) doc.coverColor = body.coverColor ?? null;
  if (body.status !== undefined) doc.status = body.status;

  await doc.save();

  const eventDto = await toEventWithMeta(doc, userId);
  serverEventBus.emitUpdated({ serverId: doc.serverId.toString(), eventId, event: eventDto });
  return eventDto;
}

/**
 * Deletes an event and all its RSVPs.
 * Only the creator or server owner may delete.
 * Emits realtime `deleted` notification.
 */
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const doc = await ServerEvent.findById(eventId).exec();
  if (!doc) throw notFound('event');
  await assertEventEditor(userId, doc);

  const serverId = doc.serverId.toString();
  await Promise.all([doc.deleteOne(), EventRsvp.deleteMany({ eventId })]);
  serverEventBus.emitDeleted({ serverId, eventId });
}

/**
 * Upserts (or toggles off) an RSVP for the caller.
 * If the caller's existing status matches `status`, removes it (toggle off).
 * Emits realtime `rsvp_changed` notification.
 */
export async function upsertRsvp(
  userId: string,
  eventId: string,
  status: 'going' | 'interested',
): Promise<void> {
  const doc = await ServerEvent.findById(eventId).exec();
  if (!doc) throw notFound('event');
  await assertServerMember(userId, doc.serverId.toString());

  const existing = await EventRsvp.findOne({ eventId, userId }).exec();

  if (existing && existing.status === status) {
    // Toggle off — same status clicked again
    await existing.deleteOne();
  } else if (existing) {
    // Switch status
    existing.status = status;
    await existing.save();
  } else {
    await EventRsvp.create({ eventId, userId, status });
  }

  const counts = await getRsvpCounts(eventId);
  serverEventBus.emitRsvpChanged({
    serverId: doc.serverId.toString(),
    eventId,
    ...counts,
  });
}

/**
 * Removes the caller's RSVP entirely regardless of status.
 * Emits realtime `rsvp_changed` notification.
 */
export async function removeRsvp(userId: string, eventId: string): Promise<void> {
  const doc = await ServerEvent.findById(eventId).exec();
  if (!doc) throw notFound('event');
  await assertServerMember(userId, doc.serverId.toString());

  const deleted = await EventRsvp.findOneAndDelete({ eventId, userId }).lean();
  if (!deleted) {
    // Nothing to remove — not an error, just a no-op
    logger.info({ userId, eventId }, 'events: removeRsvp — no RSVP found, ignoring');
    return;
  }

  const counts = await getRsvpCounts(eventId);
  serverEventBus.emitRsvpChanged({
    serverId: doc.serverId.toString(),
    eventId,
    ...counts,
  });
}
