import { Router } from 'express';

import { badRequest } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  categoryIdParam,
  categoryListQuery,
  createCategoryBody,
  createEventBody,
  eventIdParam,
  eventRangeQuery,
  mineRangeQuery,
  updateCategoryBody,
  updateEventBody,
} from './schemas.js';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from './category-service.js';
import {
  createEvent,
  deleteEvent,
  listEventsInRange,
  updateEvent,
} from './event-service.js';

export const calendarRouter: Router = Router();

// ── Events ────────────────────────────────────────────────────────────────

/**
 * GET /calendar/events?from&to&channelId?
 *
 * Lists events in a time window for either the caller's personal calendar
 * (when `channelId` is omitted) or a channel's shared calendar. Range is
 * half-open `[from, to)`. Recurrences are expanded inside the window.
 */
calendarRouter.get('/events', requireAuth, async (req, res, next) => {
  try {
    const q = eventRangeQuery.parse(req.query);
    const events = await listEventsInRange({
      userId: req.userId!,
      channelId: q.channelId,
      from: new Date(q.from),
      to: new Date(q.to),
    });
    res.json(ok({ events }));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /calendar/events/mine?from&to
 *
 * Personal events only for v1. Once channels lands, this merges in shared
 * events from every channel the caller is a member of. Declared before
 * `/events/:id` so the dynamic route doesn't claim `mine`.
 */
calendarRouter.get('/events/mine', requireAuth, async (req, res, next) => {
  try {
    const q = mineRangeQuery.parse(req.query);
    const events = await listEventsInRange({
      userId: req.userId!,
      from: new Date(q.from),
      to: new Date(q.to),
    });
    res.json(ok({ events }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /calendar/events
 *
 * Creates either a personal event (`channelId: null`) or a channel event.
 * Author becomes the only user allowed to edit / delete.
 */
calendarRouter.post('/events', requireAuth, async (req, res, next) => {
  try {
    const body = createEventBody.parse(req.body);
    const event = await createEvent({ userId: req.userId!, body });
    res.status(201).json(ok({ event }));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /calendar/events/:id
 *
 * Partial update. Only the author can edit.
 */
calendarRouter.patch('/events/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = eventIdParam.parse(req.params);
    const patch = updateEventBody.parse(req.body);
    const event = await updateEvent({ userId: req.userId!, eventId: id, patch });
    res.json(ok({ event }));
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /calendar/events/:id
 *
 * Author-only.
 */
calendarRouter.delete('/events/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = eventIdParam.parse(req.params);
    const result = await deleteEvent({ userId: req.userId!, eventId: id });
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

// ── Categories ─────────────────────────────────────────────────────────────

/**
 * GET /calendar/categories?scope&channelId?
 *
 * Returns all categories for the requested scope, seeding the six study-
 * domain built-ins on first read.
 */
calendarRouter.get('/categories', requireAuth, async (req, res, next) => {
  try {
    const q = categoryListQuery.parse(req.query);
    if (q.scope === 'channel' && !q.channelId) {
      throw badRequest('missing_channel_id', '`channelId` is required when scope=channel');
    }
    const ownerId = q.scope === 'channel' ? q.channelId! : req.userId!;
    const categories = await listCategories({ scope: q.scope, ownerId });
    res.json(ok({ categories }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /calendar/categories
 *
 * Create a non-builtin category. `name` must be unique inside the scope
 * (UI-enforced for now; collisions allowed at the DB layer).
 */
calendarRouter.post('/categories', requireAuth, async (req, res, next) => {
  try {
    const body = createCategoryBody.parse(req.body);
    if (body.scope === 'channel' && !body.channelId) {
      throw badRequest('missing_channel_id', '`channelId` is required when scope=channel');
    }
    const ownerId = body.scope === 'channel' ? body.channelId! : req.userId!;
    const category = await createCategory({
      scope: body.scope,
      ownerId,
      name: body.name,
      color: body.color,
    });
    res.status(201).json(ok({ category }));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /calendar/categories/:id
 *
 * Rename / recolor. Built-ins allowed; only the scope owner can write.
 */
calendarRouter.patch('/categories/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = categoryIdParam.parse(req.params);
    const patch = updateCategoryBody.parse(req.body);
    const category = await updateCategory({
      categoryId: id,
      userId: req.userId!,
      patch,
    });
    res.json(ok({ category }));
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /calendar/categories/:id
 *
 * Disallowed for built-ins. Disallowed when events still reference it.
 */
calendarRouter.delete('/categories/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = categoryIdParam.parse(req.params);
    const result = await deleteCategory({ categoryId: id, userId: req.userId! });
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});
