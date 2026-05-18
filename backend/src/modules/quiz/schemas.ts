import { z } from 'zod';

/**
 * Discriminated-union question schema. The same shape is used by:
 *   - Mongoose validation (via custom validator on the questions array)
 *   - REST input parsing (PATCH /quiz/:id/questions)
 *   - Server-side redaction before sending to a participant
 *
 * The `id` is a client-generated short slug so option references survive
 * reorders without server round-trips.
 */

const optionId = z.string().min(1).max(64);
const questionId = z.string().min(1).max(64);

/**
 * The persistence schema is intentionally lenient — empty option text, empty
 * prompts, zero correct answers all pass. The host edits live and autosaves
 * on every keystroke; rejecting an in-progress draft on a missing field
 * would 400 every other keystroke. Structural completeness (non-empty
 * prompt, ≥ 2 options, correct count) is enforced in `launchQuiz` only.
 */
const optionSchema = z.object({
  id: optionId,
  text: z.string().max(280),
  isCorrect: z.boolean(),
  explanation: z.string().max(280).optional(),
});

const baseQuestion = {
  id: questionId,
  prompt: z.string().max(500),
  explanation: z.string().max(280).optional(),
};

export const mcqSingleQuestion = z.object({
  ...baseQuestion,
  type: z.literal('mcq_single'),
  options: z.array(optionSchema).max(8, 'No more than eight options'),
});

export const mcqMultiQuestion = z.object({
  ...baseQuestion,
  type: z.literal('mcq_multi'),
  options: z.array(optionSchema).max(8, 'No more than eight options'),
});

export const trueFalseQuestion = z.object({
  ...baseQuestion,
  type: z.literal('true_false'),
  correct: z.boolean(),
});

export const shortAnswerQuestion = z.object({
  ...baseQuestion,
  type: z.literal('short'),
  referenceAnswer: z.string().max(500).optional(),
});

export const quizQuestionSchema = z.discriminatedUnion('type', [
  mcqSingleQuestion,
  mcqMultiQuestion,
  trueFalseQuestion,
  shortAnswerQuestion,
]);
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

/**
 * Hard ceiling on questions per quiz. Enforced at the REST boundary
 * (PATCH /quiz/:id) and again by the AI exam generator so a runaway
 * model call can't blow past the limit. Bumped from 50 to 100 when
 * the AI generator landed — humans rarely author past 30, but a
 * "generate me a full final" should comfortably hit a real exam size.
 */
export const MAX_QUESTIONS_PER_QUIZ = 100;

export const quizSettingsSchema = z.object({
  timePerQuestionSec: z.number().int().min(5).max(300).nullable(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  showLeaderboard: z.boolean(),
});
export type QuizSettings = z.infer<typeof quizSettingsSchema>;

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  timePerQuestionSec: 30,
  shuffleQuestions: false,
  shuffleOptions: false,
  showLeaderboard: true,
};

export const quizStatusSchema = z.enum(['draft', 'live', 'open', 'closed']);
export type QuizStatus = z.infer<typeof quizStatusSchema>;

export const quizModeSchema = z.enum(['live', 'async']);
export type QuizMode = z.infer<typeof quizModeSchema>;

// ── REST inputs ────────────────────────────────────────────────────────────

export const channelIdQuery = z.object({
  channelId: z.string().uuid('channelId must be a UUID'),
});

export const quizIdParam = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'id must be an ObjectId'),
});

export const attemptIdParam = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'id must be an ObjectId'),
  attemptId: z.string().regex(/^[a-f0-9]{24}$/i, 'attemptId must be an ObjectId'),
});

export const createQuizBody = z.object({
  channelId: z.string().uuid(),
  title: z.string().min(1).max(120),
});
export type CreateQuizBody = z.infer<typeof createQuizBody>;

export const updateQuizBody = z
  .object({
    // Title may be transiently empty while the host is retyping; launch
    // enforces non-empty.
    title: z.string().max(120).optional(),
    questions: z.array(quizQuestionSchema).max(MAX_QUESTIONS_PER_QUIZ).optional(),
    settings: quizSettingsSchema.partial().optional(),
  })
  .refine((b) => b.title !== undefined || b.questions !== undefined || b.settings !== undefined, {
    message: 'At least one field required',
  });
export type UpdateQuizBody = z.infer<typeof updateQuizBody>;

export const launchQuizBody = z.object({
  mode: quizModeSchema,
});
export type LaunchQuizBody = z.infer<typeof launchQuizBody>;

// ── Attempt answer payloads (per question type) ────────────────────────────

export const submitAnswerBody = z.object({
  questionId,
  selectedOptionIds: z.array(optionId).max(8).optional(),
  selectedBool: z.boolean().optional(),
  text: z.string().max(2000).optional(),
});
export type SubmitAnswerBody = z.infer<typeof submitAnswerBody>;

export const gradeAnswerBody = z.object({
  questionId,
  isCorrect: z.boolean(),
});
export type GradeAnswerBody = z.infer<typeof gradeAnswerBody>;
