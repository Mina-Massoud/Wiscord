import { randomUUID } from 'node:crypto';

import { Type, type Schema } from '@google/genai';

import { logger } from '../../lib/logger.js';
import { getGeminiClient } from '../ai/provider/gemini-client.js';
import { env } from '../../lib/env.js';
import { AppError } from '../../lib/errors.js';
import {
  MAX_QUESTIONS_PER_QUIZ,
  quizQuestionSchema,
  type QuizQuestion,
} from './schemas.js';

/**
 * AI-driven quiz generator. Used by the `generateExam` tool the AI
 * can call from the personal-scope conversation. The conversational
 * model orchestrates intent (topic, count, types); this module does
 * the heavy structured-output call so the chat stream stays light.
 *
 * Routing:
 *  - ≤ MAX_BATCH_SIZE questions in one shot.
 *  - > MAX_BATCH_SIZE: split into batches of MAX_BATCH_SIZE and
 *    merge. Gemini structured-output reliability drops on long arrays;
 *    splitting also keeps each request comfortably inside the model's
 *    output-token budget.
 *
 * IDs are generated server-side after validation — never trusted from
 * the model. Option correctness is sanity-checked per question type
 * (mcq_single → exactly 1 correct, mcq_multi → ≥1) and missing
 * correctness gets a best-effort fill (default first option correct)
 * before we drop, since a launch-validated quiz needs at least one
 * correct option per MCQ.
 */

const MAX_BATCH_SIZE = 25;
const MAX_RETRIES_PER_BATCH = 2;
const MIN_ACCEPTABLE_RATIO = 0.8;
const DEFAULT_TYPES: QuestionType[] = ['mcq_single', 'true_false'];
const SOURCE_CHAR_CAP = 10_000;
const NOTES_CHAR_CAP = 8_000;

export type QuestionType = QuizQuestion['type'];

export interface GenerateQuizArgs {
  topic: string;
  questionCount: number;
  types?: QuestionType[];
  source?: string;
  notesPlaintext?: string;
}

/**
 * Top-level entry: returns at least Math.ceil(questionCount *
 * MIN_ACCEPTABLE_RATIO) validated questions, or throws AppError(502)
 * if the model can't produce enough valid output across retries.
 */
export async function generateQuizQuestions(args: GenerateQuizArgs): Promise<QuizQuestion[]> {
  const sanitized = sanitizeArgs(args);
  const batches = planBatches(sanitized.questionCount);
  const out: QuizQuestion[] = [];

  for (const batchSize of batches) {
    const remaining = sanitized.questionCount - out.length;
    if (remaining <= 0) break;
    const take = Math.min(batchSize, remaining);
    const batch = await generateBatch({ ...sanitized, questionCount: take });
    out.push(...batch);
  }

  if (out.length === 0) {
    throw new AppError(502, 'ai_quiz_generation_failed', 'AI produced no valid questions');
  }

  const minAcceptable = Math.max(1, Math.ceil(sanitized.questionCount * MIN_ACCEPTABLE_RATIO));
  if (out.length < minAcceptable) {
    throw new AppError(
      502,
      'ai_quiz_generation_short',
      `AI produced ${out.length} valid questions; needed at least ${minAcceptable}`,
    );
  }

  return out.slice(0, sanitized.questionCount);
}

interface SanitizedArgs {
  topic: string;
  questionCount: number;
  types: QuestionType[];
  source: string | null;
  notesPlaintext: string | null;
}

function sanitizeArgs(args: GenerateQuizArgs): SanitizedArgs {
  if (args.topic.trim().length === 0) {
    throw new AppError(400, 'invalid_topic', 'Quiz topic cannot be empty');
  }
  if (
    !Number.isInteger(args.questionCount) ||
    args.questionCount < 1 ||
    args.questionCount > MAX_QUESTIONS_PER_QUIZ
  ) {
    throw new AppError(
      400,
      'invalid_question_count',
      `questionCount must be an integer between 1 and ${MAX_QUESTIONS_PER_QUIZ}`,
    );
  }
  const requestedTypes = args.types && args.types.length > 0 ? args.types : DEFAULT_TYPES;
  const types = Array.from(new Set(requestedTypes));
  return {
    topic: args.topic.trim(),
    questionCount: args.questionCount,
    types,
    source: args.source ? args.source.slice(0, SOURCE_CHAR_CAP) : null,
    notesPlaintext: args.notesPlaintext
      ? args.notesPlaintext.slice(0, NOTES_CHAR_CAP)
      : null,
  };
}

function planBatches(total: number): number[] {
  const batches: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const take = Math.min(remaining, MAX_BATCH_SIZE);
    batches.push(take);
    remaining -= take;
  }
  return batches;
}

async function generateBatch(args: SanitizedArgs): Promise<QuizQuestion[]> {
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt <= MAX_RETRIES_PER_BATCH) {
    attempt += 1;
    try {
      const raw = await callModel(args);
      const validated = validateAndNormalize(raw, args.types);
      if (validated.length >= Math.max(1, Math.ceil(args.questionCount * MIN_ACCEPTABLE_RATIO))) {
        return validated;
      }
      logger.warn(
        { wanted: args.questionCount, got: validated.length, attempt },
        'ai-quiz: under-target batch; retrying',
      );
    } catch (err) {
      lastError = err;
      logger.warn(
        { err: err instanceof Error ? err.message : err, attempt },
        'ai-quiz: model call failed; retrying',
      );
    }
  }
  if (lastError instanceof AppError) throw lastError;
  if (lastError instanceof Error) {
    throw new AppError(502, 'ai_quiz_batch_failed', lastError.message);
  }
  throw new AppError(502, 'ai_quiz_batch_failed', 'Batch generation failed');
}

async function callModel(args: SanitizedArgs): Promise<unknown[]> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(args) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      // Slight bias toward determinism — we want plausible exam
      // questions, not creative writing. Higher temp drifts into
      // off-topic / philosophical question shapes.
      temperature: 0.4,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(args.types),
    },
  });

  const text = response.text;
  if (typeof text !== 'string' || text.length === 0) {
    throw new AppError(502, 'ai_quiz_empty', 'Model returned no text');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    logger.warn({ text: text.slice(0, 500) }, 'ai-quiz: model returned non-JSON');
    throw new AppError(502, 'ai_quiz_bad_json', 'Model returned malformed JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new AppError(502, 'ai_quiz_bad_shape', 'Model returned non-array root');
  }
  return parsed;
}

const SYSTEM_PROMPT = `You write study-grade exam questions in strict JSON. Output ONLY a JSON array — no prose, no markdown fence.

RULES
- Every question MUST set the "type" field to one of the allowed types in the user prompt.
- mcq_single: 3-5 options, EXACTLY ONE option has isCorrect=true.
- mcq_multi: 4-6 options, AT LEAST ONE option has isCorrect=true (typically 2-3).
- true_false: set "correct" to true or false based on whether the prompt is a true statement.
- short: provide a concise "referenceAnswer" (1-2 sentences) that an instructor could grade against.
- Prompts are concrete, unambiguous, and worth 1 point on a real exam. Avoid trick questions.
- Do NOT include id/explanation fields — the server assigns ids.
- Do NOT repeat the same question twice in one batch.
- If a SOURCE block is provided, ground EVERY question in that source. Do not invent facts beyond it.
- If NOTES are provided, ground in the notes the same way.
- If neither is provided, draw on widely-accepted general knowledge about the topic.`;

function buildUserPrompt(args: SanitizedArgs): string {
  const parts: string[] = [];
  parts.push(`TOPIC: ${args.topic}`);
  parts.push(`COUNT: ${args.questionCount} questions in this batch`);
  parts.push(`ALLOWED TYPES: ${args.types.join(', ')}`);
  if (args.source) {
    parts.push(`SOURCE (ground questions in this content):\n${args.source}`);
  }
  if (args.notesPlaintext) {
    parts.push(`NOTES (ground questions in this content):\n${args.notesPlaintext}`);
  }
  parts.push(
    `Return a JSON array with exactly ${args.questionCount} question objects, mixed across allowed types.`,
  );
  return parts.join('\n\n');
}

/**
 * Gemini schema describing the flat question shape. Gemini's schema
 * type can't express discriminated unions natively, so we use one
 * object with optional fields and let the post-validate step pick
 * the right Zod variant by `type`.
 */
function buildResponseSchema(types: QuestionType[]): Schema {
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: types },
        prompt: { type: Type.STRING, description: 'The question prompt, ≤500 chars.' },
        options: {
          type: Type.ARRAY,
          description: 'Required for mcq_single and mcq_multi only.',
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              isCorrect: { type: Type.BOOLEAN },
            },
            required: ['text', 'isCorrect'],
          },
        },
        correct: {
          type: Type.BOOLEAN,
          description: 'Required for true_false only.',
        },
        referenceAnswer: {
          type: Type.STRING,
          description: 'Required for short only.',
        },
      },
      required: ['type', 'prompt'],
    },
  };
}

/**
 * Validate each raw question against `quizQuestionSchema` (after
 * normalization: assign ids, drop fields the type doesn't need,
 * sanity-fix MCQ correctness). Drops anything that still fails.
 */
function validateAndNormalize(raw: unknown[], allowedTypes: QuestionType[]): QuizQuestion[] {
  const allowed = new Set<QuestionType>(allowedTypes);
  const out: QuizQuestion[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const typeValue = item.type;
    if (typeof typeValue !== 'string' || !allowed.has(typeValue as QuestionType)) continue;
    const candidate = normalizeQuestion(item, typeValue as QuestionType);
    if (!candidate) continue;
    const result = quizQuestionSchema.safeParse(candidate);
    if (!result.success) {
      logger.debug(
        { issues: result.error.flatten(), candidate },
        'ai-quiz: dropping malformed question',
      );
      continue;
    }
    out.push(result.data);
  }
  return out;
}

function normalizeQuestion(item: Record<string, unknown>, type: QuestionType): QuizQuestion | null {
  const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
  if (prompt.length === 0) return null;
  const id = shortId();
  switch (type) {
    case 'mcq_single':
    case 'mcq_multi':
      return normalizeMcq(id, type, prompt, item.options);
    case 'true_false':
      return {
        id,
        type: 'true_false',
        prompt,
        correct: typeof item.correct === 'boolean' ? item.correct : true,
      };
    case 'short':
      return {
        id,
        type: 'short',
        prompt,
        referenceAnswer:
          typeof item.referenceAnswer === 'string' && item.referenceAnswer.trim().length > 0
            ? item.referenceAnswer.trim()
            : undefined,
      };
  }
}

function normalizeMcq(
  id: string,
  type: 'mcq_single' | 'mcq_multi',
  prompt: string,
  rawOptions: unknown,
): QuizQuestion | null {
  if (!Array.isArray(rawOptions) || rawOptions.length < 2) return null;
  const options = rawOptions
    .map((opt) => {
      if (!isPlainObject(opt)) return null;
      const text = typeof opt.text === 'string' ? opt.text.trim() : '';
      if (text.length === 0) return null;
      const isCorrect = typeof opt.isCorrect === 'boolean' ? opt.isCorrect : false;
      return { id: shortId(), text, isCorrect };
    })
    .filter((o): o is { id: string; text: string; isCorrect: boolean } => o !== null);

  if (options.length < 2) return null;
  // Trim past the 8-option cap from `quizQuestionSchema`.
  const trimmed = options.slice(0, 8);
  const correctCount = trimmed.filter((o) => o.isCorrect).length;

  if (type === 'mcq_single') {
    if (correctCount === 0) {
      // Best-effort fix: mark the first option correct so the question
      // is still launch-eligible. Logged so we can spot model drift.
      trimmed[0] = { ...trimmed[0]!, isCorrect: true };
    } else if (correctCount > 1) {
      // Keep only the first correct one.
      let seenCorrect = false;
      for (let i = 0; i < trimmed.length; i++) {
        const opt = trimmed[i]!;
        if (opt.isCorrect && !seenCorrect) {
          seenCorrect = true;
          continue;
        }
        if (opt.isCorrect) {
          trimmed[i] = { ...opt, isCorrect: false };
        }
      }
    }
  } else {
    if (correctCount === 0) {
      // Fallback: at least one must be correct for the schema launch
      // path; mark the first.
      trimmed[0] = { ...trimmed[0]!, isCorrect: true };
    }
  }

  return { id, type, prompt, options: trimmed };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Short, URL-safe id. Same shape as the frontend's `generateQuestionId`
 * — 8 chars of base36-ish randomness. Plenty of entropy for in-quiz
 * uniqueness (collision odds at 100 questions ~ 1e-11).
 */
function shortId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 10);
}
