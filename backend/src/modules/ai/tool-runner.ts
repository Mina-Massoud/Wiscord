import { z } from 'zod';

import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { listCategories } from '../calendar/category-service.js';
import { createEvent, deleteEvent, updateEvent } from '../calendar/event-service.js';
import { createNoteFromMarkdown } from '../notes/note-creator.js';
import { generateQuizQuestions } from '../quiz/ai-generator.js';
import { MAX_QUESTIONS_PER_QUIZ } from '../quiz/schemas.js';
import { createQuiz, updateQuiz } from '../quiz/service.js';
import { getNotePlaintext } from './notes-plaintext.js';
import { formatInZone, normalizeLocalIso, STRICT_DATETIME_RE } from './time-normalize.js';

/**
 * Tools the AI can invoke. Five for v1:
 *   - `createCalendarEvent` — runs immediately
 *   - `updateCalendarEvent` — defers to user confirmation (destructive)
 *   - `deleteCalendarEvent` — defers to user confirmation (destructive)
 *   - `createNote`          — runs immediately (creates a new doc;
 *                             reversible via user deletion in
 *                             /app/labs/notes, so not destructive)
 *   - `generateExam`        — defers to user confirmation (writes a
 *                             potentially-large quiz that the user
 *                             will want to preview before launching)
 *
 * Args are Zod-validated before any DB mutation. Execution rides
 * the existing calendar / notes / quiz services so authz + business
 * rules are reused — the AI is just another caller, not a privileged
 * path.
 *
 * Datetime args are normalized server-side against the caller's
 * IANA timezone (see `time-normalize.ts`). The model often emits
 * naive ISO ("2026-05-17T18:00:00") or the wrong offset; the
 * server is the source of truth, not the prompt.
 */

export const TOOL_NAMES = [
  'createCalendarEvent',
  'updateCalendarEvent',
  'deleteCalendarEvent',
  'createNote',
  'generateExam',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** Accept only strict ISO 8601 datetimes — naive or offset-aware.
 *  Anything looser (`tomorrow`, `5pm`, `2026/05/17`) is rejected. */
const isoString = z.string().regex(STRICT_DATETIME_RE, 'must be ISO 8601 datetime');

export const createCalendarEventArgs = z.object({
  title: z.string().trim().min(1).max(200),
  startAt: isoString,
  endAt: isoString,
  description: z.string().max(4000).optional(),
  allDay: z.boolean().optional(),
});

export const updateCalendarEventArgs = z.object({
  eventId: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  startAt: isoString.optional(),
  endAt: isoString.optional(),
  description: z.string().max(4000).optional(),
  allDay: z.boolean().optional(),
});

export const deleteCalendarEventArgs = z.object({
  eventId: z.string().min(1),
});

/**
 * `createNote` args. Markdown cap at 20k chars (about ~5k tokens at
 * GPT-style ratios) — comfortably above what a generated study plan
 * needs and well under the Mongo BSON limit even after Yjs encoding.
 * Title is a separate field so the model can supply a clean chip
 * label even if it forgets to lead the markdown with an H1; the
 * note-creator prepends it as `# Title` when needed.
 */
export const createNoteArgs = z.object({
  title: z.string().trim().min(1).max(200),
  markdown: z.string().min(1).max(20_000),
});

/**
 * `generateExam` args. The conversational model picks topic / count /
 * types from the user's prompt and supplies a channelId (it must ask
 * the user first if they didn't specify one — see `stream-personal.ts`
 * tool description). `useChannelNotes=true` makes the runner pull the
 * channel's note doc as grounding material; `source` is raw text the
 * user pasted in chat. Caps mirror the generator's internal caps
 * (10k source, 100 questions).
 */
export const generateExamArgs = z.object({
  channelId: z.string().uuid('channelId must be a UUID'),
  title: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(500),
  questionCount: z
    .number()
    .int()
    .min(1)
    .max(MAX_QUESTIONS_PER_QUIZ, `questionCount cannot exceed ${MAX_QUESTIONS_PER_QUIZ}`),
  types: z
    .array(z.enum(['mcq_single', 'mcq_multi', 'true_false', 'short']))
    .min(1)
    .max(4)
    .optional(),
  source: z.string().max(10_000).optional(),
  useChannelNotes: z.boolean().optional(),
});

export type CreateCalendarEventArgs = z.infer<typeof createCalendarEventArgs>;
export type UpdateCalendarEventArgs = z.infer<typeof updateCalendarEventArgs>;
export type DeleteCalendarEventArgs = z.infer<typeof deleteCalendarEventArgs>;
export type CreateNoteArgs = z.infer<typeof createNoteArgs>;
export type GenerateExamArgs = z.infer<typeof generateExamArgs>;

/** True for tools the user must explicitly confirm before they run. */
export function isDestructive(name: ToolName): boolean {
  return (
    name === 'updateCalendarEvent' ||
    name === 'deleteCalendarEvent' ||
    name === 'generateExam'
  );
}

/**
 * Validate the AI's raw tool args. Returns the parsed payload or
 * throws AppError(400) with the Zod issues — caller wraps the
 * error into a `tool_result` SSE event.
 */
export function validateToolArgs(name: ToolName, args: unknown): unknown {
  const parser = pickArgsParser(name);
  const result = parser.safeParse(args);
  if (!result.success) {
    throw new AppError(400, 'invalid_tool_args', JSON.stringify(result.error.flatten()));
  }
  return result.data;
}

function pickArgsParser(name: ToolName): z.ZodTypeAny {
  switch (name) {
    case 'createCalendarEvent':
      return createCalendarEventArgs;
    case 'updateCalendarEvent':
      return updateCalendarEventArgs;
    case 'deleteCalendarEvent':
      return deleteCalendarEventArgs;
    case 'createNote':
      return createNoteArgs;
    case 'generateExam':
      return generateExamArgs;
  }
}

interface RunArgs {
  userId: string;
  name: ToolName;
  args: unknown;
  /** IANA timezone of the caller. Used to anchor naive ISO
   *  datetimes the model emits ("2026-05-17T18:00:00" → that wall
   *  clock in the user's zone) and to format result times in the
   *  same zone so the model's conversation history stays
   *  consistent. */
  timezone?: string;
}

/**
 * Execute a non-destructive tool immediately. Destructive tools
 * must NOT call this directly — they go through `runConfirmedTool`
 * after the user clicks "Confirm" on the frontend.
 */
export async function runTool(
  args: RunArgs,
): Promise<{ result: Record<string, unknown> }> {
  const validated = validateToolArgs(args.name, args.args);
  switch (args.name) {
    case 'createCalendarEvent':
      return {
        result: await runCreate(args.userId, validated as CreateCalendarEventArgs, args.timezone),
      };
    case 'createNote':
      return { result: await runCreateNote(args.userId, validated as CreateNoteArgs) };
    case 'updateCalendarEvent':
    case 'deleteCalendarEvent':
    case 'generateExam':
      // These should always go through the confirmation path —
      // never executed by the stream loop directly.
      throw new AppError(
        400,
        'tool_requires_confirmation',
        `${args.name} requires user confirmation before executing`,
      );
  }
}

/**
 * Execute a destructive tool after the user has confirmed it on
 * the frontend. Validation is re-run server-side (defense in
 * depth) — the frontend never gets to skip the validator.
 *
 * Non-destructive tools (createCalendarEvent, createNote) are also
 * accepted here for symmetry — useful if a future flow wants to
 * batch-replay tool calls from history.
 */
export async function runConfirmedTool(
  args: RunArgs,
): Promise<{ result: Record<string, unknown> }> {
  const validated = validateToolArgs(args.name, args.args);
  switch (args.name) {
    case 'createCalendarEvent':
      return {
        result: await runCreate(args.userId, validated as CreateCalendarEventArgs, args.timezone),
      };
    case 'updateCalendarEvent':
      return {
        result: await runUpdate(args.userId, validated as UpdateCalendarEventArgs, args.timezone),
      };
    case 'deleteCalendarEvent':
      return { result: await runDelete(args.userId, validated as DeleteCalendarEventArgs) };
    case 'createNote':
      return { result: await runCreateNote(args.userId, validated as CreateNoteArgs) };
    case 'generateExam':
      return { result: await runGenerateExam(args.userId, validated as GenerateExamArgs) };
  }
}

async function runCreate(
  userId: string,
  args: CreateCalendarEventArgs,
  timezone: string | undefined,
): Promise<Record<string, unknown>> {
  // The AI doesn't know about categories — pick the user's first
  // (`General` by seed convention). When the channels module
  // lands and personal scope grows category-awareness we'll let
  // the model pick by name.
  const categories = await listCategories({ scope: 'user', ownerId: userId });
  const defaultCategory = categories[0];
  if (!defaultCategory) {
    throw new AppError(500, 'no_default_category', 'No default category available');
  }
  const startAt = normalizeLocalIso(args.startAt, timezone);
  const endAt = normalizeLocalIso(args.endAt, timezone);
  if (startAt !== args.startAt || endAt !== args.endAt) {
    logger.info(
      { userId, timezone, rawStart: args.startAt, rawEnd: args.endAt, startAt, endAt },
      'ai: normalized naive tool datetimes to caller timezone',
    );
  }
  const dto = await createEvent({
    userId,
    body: {
      channelId: null,
      categoryId: defaultCategory.id,
      title: args.title,
      description: args.description ?? '',
      startAt,
      endAt,
      allDay: args.allDay ?? false,
      recurrence: { freq: 'none', count: 1 },
    },
  });
  logger.info({ userId, eventId: dto.id, title: dto.title }, 'ai: created calendar event');
  return {
    eventId: dto.id,
    title: dto.title,
    startAt: formatInZone(new Date(dto.startAt), timezone),
    endAt: formatInZone(new Date(dto.endAt), timezone),
  };
}

async function runUpdate(
  userId: string,
  args: UpdateCalendarEventArgs,
  timezone: string | undefined,
): Promise<Record<string, unknown>> {
  const startAt = args.startAt !== undefined ? normalizeLocalIso(args.startAt, timezone) : undefined;
  const endAt = args.endAt !== undefined ? normalizeLocalIso(args.endAt, timezone) : undefined;
  const dto = await updateEvent({
    userId,
    eventId: args.eventId,
    patch: {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(startAt !== undefined ? { startAt } : {}),
      ...(endAt !== undefined ? { endAt } : {}),
      ...(args.description !== undefined ? { description: args.description } : {}),
      ...(args.allDay !== undefined ? { allDay: args.allDay } : {}),
    },
  });
  logger.info({ userId, eventId: dto.id }, 'ai: updated calendar event');
  return {
    eventId: dto.id,
    title: dto.title,
    startAt: formatInZone(new Date(dto.startAt), timezone),
    endAt: formatInZone(new Date(dto.endAt), timezone),
  };
}

async function runDelete(
  userId: string,
  args: DeleteCalendarEventArgs,
): Promise<Record<string, unknown>> {
  await deleteEvent({ userId, eventId: args.eventId });
  logger.info({ userId, eventId: args.eventId }, 'ai: deleted calendar event');
  return { eventId: args.eventId, deleted: true };
}

async function runCreateNote(
  userId: string,
  args: CreateNoteArgs,
): Promise<Record<string, unknown>> {
  const { channelId, title } = await createNoteFromMarkdown({
    userId,
    title: args.title,
    markdown: args.markdown,
  });
  return { channelId, title };
}

/**
 * Generate an AI exam and persist it as a draft quiz. The
 * conversational model orchestrated intent (topic, count, types, which
 * channel); we do the heavy structured-output call here, validate,
 * create the quiz with `status='draft'`, and return the deep-link the
 * model echoes back as a `[quiz:<id>]` citation chip.
 *
 * The link points at the existing workshop route so the user lands on
 * the editable builder — they review/edit before launching, never
 * auto-launches.
 */
async function runGenerateExam(
  userId: string,
  args: GenerateExamArgs,
): Promise<Record<string, unknown>> {
  const notesPlaintext = args.useChannelNotes
    ? await getNotePlaintext(args.channelId)
    : '';

  const questions = await generateQuizQuestions({
    topic: args.topic,
    questionCount: args.questionCount,
    types: args.types,
    source: args.source,
    notesPlaintext: notesPlaintext.length > 0 ? notesPlaintext : undefined,
  });

  // Two-step write: createQuiz mints the row (draft, no questions),
  // then updateQuiz drops the generated questions onto it. Mirrors the
  // human authoring flow — same authz, same validators, same audit
  // trail — instead of going around the service layer.
  const created = await createQuiz({
    userId,
    channelId: args.channelId,
    title: args.title,
  });
  const quizId = String(created._id);

  await updateQuiz({
    userId,
    quizId,
    patch: { questions },
  });

  const link = `/app/labs/quiz/${args.channelId}?quiz=${quizId}`;
  logger.info(
    {
      userId,
      quizId,
      channelId: args.channelId,
      requested: args.questionCount,
      produced: questions.length,
    },
    'ai: generated exam quiz',
  );

  return {
    quizId,
    channelId: args.channelId,
    title: args.title,
    questionCount: questions.length,
    link,
  };
}
