import { Router } from 'express';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  createEventBody,
  eventIdParam,
  serverIdParam,
  updateEventBody,
  upsertRsvpBody,
} from './schemas.js';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listServerEvents,
  removeRsvp,
  updateEvent,
  upsertRsvp,
} from './service.js';

export const eventsRouter: Router = Router();

eventsRouter.use(requireAuth);

// ─── Server-scoped event routes (/servers/:serverId/events) ──────────────────

/** GET /servers/:serverId/events — all events for a server (upcoming + past). */
eventsRouter.get('/servers/:serverId/events', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const events = await listServerEvents(req.userId!, serverId);
    res.json(ok({ events }));
  } catch (err) {
    next(err);
  }
});

/** POST /servers/:serverId/events — create a new event. */
eventsRouter.post('/servers/:serverId/events', async (req, res, next) => {
  try {
    const { serverId } = serverIdParam.parse(req.params);
    const body = createEventBody.parse(req.body);
    const event = await createEvent(req.userId!, serverId, body);
    res.status(201).json(ok({ event }));
  } catch (err) {
    next(err);
  }
});

// ─── Event-level routes (/events/:eventId) ───────────────────────────────────

/** GET /events/:eventId — single event detail with RSVP counts. */
eventsRouter.get('/events/:eventId', async (req, res, next) => {
  try {
    const { eventId } = eventIdParam.parse(req.params);
    const event = await getEvent(req.userId!, eventId);
    res.json(ok({ event }));
  } catch (err) {
    next(err);
  }
});

/** PATCH /events/:eventId — update title/description/times/type/status. */
eventsRouter.patch('/events/:eventId', async (req, res, next) => {
  try {
    const { eventId } = eventIdParam.parse(req.params);
    const body = updateEventBody.parse(req.body);
    const event = await updateEvent(req.userId!, eventId, body);
    res.json(ok({ event }));
  } catch (err) {
    next(err);
  }
});

/** DELETE /events/:eventId — remove event and all its RSVPs. */
eventsRouter.delete('/events/:eventId', async (req, res, next) => {
  try {
    const { eventId } = eventIdParam.parse(req.params);
    await deleteEvent(req.userId!, eventId);
    res.json(ok({ deleted: true }));
  } catch (err) {
    next(err);
  }
});

// ─── RSVP routes (/events/:eventId/rsvp) ────────────────────────────────────

/** POST /events/:eventId/rsvp — upsert (or toggle off) an RSVP. */
eventsRouter.post('/events/:eventId/rsvp', async (req, res, next) => {
  try {
    const { eventId } = eventIdParam.parse(req.params);
    const body = upsertRsvpBody.parse(req.body);
    await upsertRsvp(req.userId!, eventId, body.status);
    res.json(ok({ success: true }));
  } catch (err) {
    next(err);
  }
});

/** DELETE /events/:eventId/rsvp — withdraw RSVP entirely. */
eventsRouter.delete('/events/:eventId/rsvp', async (req, res, next) => {
  try {
    const { eventId } = eventIdParam.parse(req.params);
    await removeRsvp(req.userId!, eventId);
    res.json(ok({ success: true }));
  } catch (err) {
    next(err);
  }
});
