import {
  CalendarCategory,
  type CalendarCategoryColor,
  type CalendarCategoryDoc,
  type CalendarCategoryScope,
} from '../../db/models/index.js';
import { CalendarEvent } from '../../db/models/CalendarEvent.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { CALENDAR_BUILTIN_CATEGORIES } from './category-defaults.js';

/**
 * Service for calendar categories.
 *
 * `seedBuiltinsForOwner` is idempotent — built-ins are keyed on
 * `{scope, ownerId, builtinSlug}` (unique partial index) so reseeding never
 * duplicates. We seed on first read so users never see an empty category
 * picker.
 */

export interface CategoryDTO {
  id: string;
  scope: CalendarCategoryScope;
  ownerId: string;
  name: string;
  color: CalendarCategoryColor;
  builtinSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDTO(doc: CalendarCategoryDoc): CategoryDTO {
  return {
    id: String(doc._id),
    scope: doc.scope,
    ownerId: doc.ownerId,
    name: doc.name,
    color: doc.color,
    builtinSlug: doc.builtinSlug ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function seedBuiltinsForOwner(args: {
  scope: CalendarCategoryScope;
  ownerId: string;
}): Promise<void> {
  // Best-effort upsert per builtin. The unique partial index guarantees that
  // a parallel request observing an empty owner can't double-insert.
  await Promise.all(
    CALENDAR_BUILTIN_CATEGORIES.map((b) =>
      CalendarCategory.updateOne(
        { scope: args.scope, ownerId: args.ownerId, builtinSlug: b.slug },
        { $setOnInsert: { name: b.name, color: b.color } },
        { upsert: true },
      ),
    ),
  );
}

export async function listCategories(args: {
  scope: CalendarCategoryScope;
  ownerId: string;
}): Promise<CategoryDTO[]> {
  await seedBuiltinsForOwner(args);
  const rows = await CalendarCategory.find({
    scope: args.scope,
    ownerId: args.ownerId,
  }).sort({ createdAt: 1 });
  return rows.map(toDTO);
}

export async function createCategory(args: {
  scope: CalendarCategoryScope;
  ownerId: string;
  name: string;
  color: CalendarCategoryColor;
}): Promise<CategoryDTO> {
  const doc = await CalendarCategory.create({
    scope: args.scope,
    ownerId: args.ownerId,
    name: args.name,
    color: args.color,
    builtinSlug: null,
  });
  return toDTO(doc);
}

export async function updateCategory(args: {
  categoryId: string;
  userId: string;
  channelId?: string;
  patch: { name?: string; color?: CalendarCategoryColor };
}): Promise<CategoryDTO> {
  const doc = await CalendarCategory.findById(args.categoryId);
  if (!doc) throw notFound('category');
  assertCategoryWriteAccess(doc, { userId: args.userId, channelId: args.channelId });

  if (args.patch.name !== undefined) doc.name = args.patch.name;
  if (args.patch.color !== undefined) doc.color = args.patch.color;
  await doc.save();
  return toDTO(doc);
}

export async function deleteCategory(args: {
  categoryId: string;
  userId: string;
  channelId?: string;
}): Promise<{ deleted: true }> {
  const doc = await CalendarCategory.findById(args.categoryId);
  if (!doc) throw notFound('category');
  assertCategoryWriteAccess(doc, { userId: args.userId, channelId: args.channelId });

  if (doc.builtinSlug !== null) {
    throw badRequest(
      'builtin_category',
      'Built-in categories cannot be deleted. Rename or recolor instead.',
    );
  }

  // Any event still pointing at this category would orphan. Reject the
  // delete with a clear error rather than silently moving them.
  const inUse = await CalendarEvent.exists({ categoryId: doc._id });
  if (inUse) {
    throw badRequest(
      'category_in_use',
      'Category still has events. Move or delete them first.',
    );
  }

  await doc.deleteOne();
  return { deleted: true };
}

/**
 * Lookup a category for an event write. Throws on missing or wrong-scope —
 * a personal event must reference a personal category owned by the user; a
 * channel event must reference a channel-scoped category for that channel.
 */
export async function resolveCategoryForEvent(args: {
  categoryId: string;
  scope: CalendarCategoryScope;
  ownerId: string;
}): Promise<CalendarCategoryDoc> {
  const doc = await CalendarCategory.findById(args.categoryId);
  if (!doc) throw notFound('category');
  if (doc.scope !== args.scope || doc.ownerId !== args.ownerId) {
    throw badRequest(
      'category_scope_mismatch',
      'Category scope does not match the event scope.',
    );
  }
  return doc;
}

function assertCategoryWriteAccess(
  doc: CalendarCategoryDoc,
  ctx: { userId: string; channelId?: string },
): void {
  if (doc.scope === 'user' && doc.ownerId !== ctx.userId) throw forbidden();
  if (doc.scope === 'channel' && doc.ownerId !== ctx.channelId) throw forbidden();
}
