import { Quiz, QuizAttempt } from '../../db/models/index.js';
import type { QuizDoc, AnswerShape } from '../../db/models/index.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { quizAnalytics } from './analytics-store.js';
import {
  quizQuestionSchema,
  type QuizQuestion,
  type QuizSettings,
  type QuizMode,
  type SubmitAnswerBody,
  type UpdateQuizBody,
  DEFAULT_QUIZ_SETTINGS,
} from './schemas.js';

/**
 * Kick off an async analytics recompute. Fire-and-forget — the calling
 * mutation never waits on this, so a slow/failing recompute can't slow a
 * participant's response. The store dedupes concurrent recomputes per quiz.
 */
function triggerAnalytics(quizId: string): void {
  void quizAnalytics.recompute(quizId);
}

/**
 * Pure business logic for the quiz module. Routes call into here; nothing in
 * here touches `req` / `res`.
 *
 * Membership check note (TODO): every endpoint here treats `requireAuth` as
 * the only gate, mirroring the voice module. Once the channel module ships,
 * gate `channelId` reads/writes on `Membership.findOne({ userId, channelId })`
 * — flip the single helper below.
 */

// TODO(channel-team): replace with Membership.findOne lookup.
async function assertChannelMember(_userId: string, _channelId: string): Promise<void> {
  return;
}

function assertHost(quiz: QuizDoc, userId: string): void {
  if (quiz.hostUserId !== userId) {
    throw forbidden('Only the quiz host can do that');
  }
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function listQuizzesForChannel(params: {
  userId: string;
  channelId: string;
}): Promise<QuizDoc[]> {
  await assertChannelMember(params.userId, params.channelId);
  return Quiz.find({ channelId: params.channelId }).sort({ updatedAt: -1 }).limit(100);
}

/**
 * Lists every quiz the caller hosts, across all channels. The labs index page
 * groups the result by `channelId` client-side so the host can jump straight
 * into any of their channels' quiz workshops.
 */
export async function listQuizzesForHost(params: { userId: string }): Promise<QuizDoc[]> {
  return Quiz.find({ hostUserId: params.userId }).sort({ updatedAt: -1 }).limit(200);
}

export async function getQuizForHost(params: {
  userId: string;
  quizId: string;
}): Promise<QuizDoc> {
  const quiz = await Quiz.findById(params.quizId);
  if (!quiz) throw notFound('quiz');
  assertHost(quiz, params.userId);
  return quiz;
}

/**
 * Participant-facing read. Strips `isCorrect`, `referenceAnswer`, and
 * per-question `explanation` from the payload — the participant only sees
 * those after submitting. Live-mode reveal is not in PR1, so the only place
 * an explanation is exposed today is in the post-submit results endpoint.
 */
export async function getQuizForParticipant(params: {
  userId: string;
  quizId: string;
}): Promise<RedactedQuiz> {
  const quiz = await Quiz.findById(params.quizId);
  if (!quiz) throw notFound('quiz');
  await assertChannelMember(params.userId, quiz.channelId);
  if (quiz.status === 'draft') {
    throw forbidden('Quiz is not open yet');
  }
  return redactQuiz(quiz);
}

// ── Write (host) ────────────────────────────────────────────────────────────

export async function createQuiz(params: {
  userId: string;
  channelId: string;
  title: string;
}): Promise<QuizDoc> {
  await assertChannelMember(params.userId, params.channelId);
  return Quiz.create({
    channelId: params.channelId,
    hostUserId: params.userId,
    title: params.title,
    status: 'draft',
    mode: null,
    questions: [],
    settings: { ...DEFAULT_QUIZ_SETTINGS },
  });
}

export async function updateQuiz(params: {
  userId: string;
  quizId: string;
  patch: UpdateQuizBody;
}): Promise<QuizDoc> {
  const quiz = await getQuizForHost({ userId: params.userId, quizId: params.quizId });
  if (quiz.status !== 'draft') {
    throw conflict('quiz_locked', 'Quiz can only be edited while it is a draft');
  }
  if (params.patch.title !== undefined) quiz.title = params.patch.title;
  if (params.patch.questions !== undefined) {
    // Re-validate at the boundary too (belt + braces vs the model validator).
    for (const q of params.patch.questions) {
      const result = quizQuestionSchema.safeParse(q);
      if (!result.success) {
        throw badRequest('invalid_question', 'One or more questions are invalid');
      }
    }
    quiz.questions = params.patch.questions;
  }
  if (params.patch.settings !== undefined) {
    quiz.settings = mergeSettings(quiz.settings, params.patch.settings);
  }
  await quiz.save();
  return quiz;
}

function mergeSettings(current: QuizSettings, patch: Partial<QuizSettings>): QuizSettings {
  return {
    timePerQuestionSec:
      patch.timePerQuestionSec !== undefined ? patch.timePerQuestionSec : current.timePerQuestionSec,
    shuffleQuestions:
      patch.shuffleQuestions !== undefined ? patch.shuffleQuestions : current.shuffleQuestions,
    shuffleOptions: patch.shuffleOptions !== undefined ? patch.shuffleOptions : current.shuffleOptions,
    showLeaderboard:
      patch.showLeaderboard !== undefined ? patch.showLeaderboard : current.showLeaderboard,
  };
}

export async function deleteQuiz(params: { userId: string; quizId: string }): Promise<void> {
  const quiz = await getQuizForHost({ userId: params.userId, quizId: params.quizId });
  if (quiz.status === 'live') {
    throw conflict('quiz_live', 'Close the quiz before deleting');
  }
  await quiz.deleteOne();
}

export async function launchQuiz(params: {
  userId: string;
  quizId: string;
  mode: QuizMode;
}): Promise<QuizDoc> {
  const quiz = await getQuizForHost({ userId: params.userId, quizId: params.quizId });
  if (quiz.status !== 'draft') {
    throw conflict('already_launched', 'Quiz has already been launched');
  }
  if (quiz.title.trim().length === 0) {
    throw badRequest('missing_title', 'Give the quiz a title before launching');
  }
  if (quiz.questions.length === 0) {
    throw badRequest('no_questions', 'Add at least one question before launching');
  }
  // The persistence schema is lenient (allows in-progress drafts). Launch is
  // the right gate for structural completeness — empty prompts, missing
  // options, missing correct answers all block here.
  for (const q of quiz.questions) {
    const shape = quizQuestionSchema.safeParse(q);
    if (!shape.success) {
      throw badRequest('invalid_question', 'One or more questions have an invalid shape');
    }
    const issue = checkLaunchReadiness(q);
    if (issue) throw badRequest('invalid_question', issue);
  }

  quiz.mode = params.mode;
  if (params.mode === 'live') {
    quiz.status = 'live';
    quiz.liveState = {
      currentQuestionIndex: 0,
      questionStartedAt: new Date(),
      revealing: false,
    };
  } else {
    quiz.status = 'open';
    quiz.liveState = null;
  }
  await quiz.save();
  triggerAnalytics(String(quiz._id));
  return quiz;
}

export async function closeQuiz(params: { userId: string; quizId: string }): Promise<QuizDoc> {
  const quiz = await getQuizForHost({ userId: params.userId, quizId: params.quizId });
  if (quiz.status === 'closed') return quiz;
  quiz.status = 'closed';
  quiz.closedAt = new Date();
  quiz.liveState = null;
  await quiz.save();
  triggerAnalytics(String(quiz._id));
  return quiz;
}

// ── Attempts (participant) ──────────────────────────────────────────────────

export async function startAttempt(params: { userId: string; quizId: string }) {
  const quiz = await Quiz.findById(params.quizId);
  if (!quiz) throw notFound('quiz');
  await assertChannelMember(params.userId, quiz.channelId);
  if (quiz.status !== 'open' && quiz.status !== 'live') {
    throw conflict('quiz_unavailable', 'Quiz is not currently open');
  }

  // Idempotent — return the existing attempt if one exists for this user.
  const existing = await QuizAttempt.findOne({ quizId: quiz._id, userId: params.userId });
  if (existing) return existing;

  const created = await QuizAttempt.create({
    quizId: quiz._id,
    userId: params.userId,
    startedAt: new Date(),
    answers: [],
    score: 0,
  });
  triggerAnalytics(String(quiz._id));
  return created;
}

export async function submitAnswer(params: {
  userId: string;
  quizId: string;
  attemptId: string;
  answer: SubmitAnswerBody;
}) {
  const quiz = await Quiz.findById(params.quizId);
  if (!quiz) throw notFound('quiz');
  if (quiz.status === 'draft' || quiz.status === 'closed') {
    throw conflict('quiz_unavailable', 'Quiz is not currently accepting answers');
  }

  const attempt = await QuizAttempt.findById(params.attemptId);
  if (!attempt) throw notFound('attempt');
  if (attempt.userId !== params.userId) throw forbidden('Not your attempt');
  if (attempt.submittedAt) throw conflict('attempt_submitted', 'Attempt already submitted');

  const question = quiz.questions.find((q) => q.id === params.answer.questionId);
  if (!question) throw notFound('question');

  const scored = scoreAnswer(question, params.answer);

  // Replace any prior answer for the same question (re-edits before submit).
  const filtered = attempt.answers.filter((a) => a.questionId !== params.answer.questionId);
  const newAnswer: AnswerShape = {
    questionId: params.answer.questionId,
    selectedOptionIds: params.answer.selectedOptionIds,
    selectedBool: params.answer.selectedBool,
    text: params.answer.text,
    answeredAt: new Date(),
    autoCorrect: scored,
    hostGraded: false,
  };
  attempt.answers = [...filtered, newAnswer];
  attempt.score = computeScore(quiz.questions, attempt.answers);
  await attempt.save();
  triggerAnalytics(params.quizId);
  return attempt;
}

export async function finalizeAttempt(params: {
  userId: string;
  quizId: string;
  attemptId: string;
}) {
  const attempt = await QuizAttempt.findById(params.attemptId);
  if (!attempt) throw notFound('attempt');
  if (attempt.userId !== params.userId) throw forbidden('Not your attempt');
  if (attempt.submittedAt) return attempt;
  attempt.submittedAt = new Date();
  await attempt.save();
  triggerAnalytics(params.quizId);
  return attempt;
}

export async function listAttempts(params: {
  userId: string;
  quizId: string;
}) {
  await getQuizForHost({ userId: params.userId, quizId: params.quizId });
  return QuizAttempt.find({ quizId: params.quizId }).sort({ submittedAt: -1, startedAt: -1 });
}

export async function gradeAnswer(params: {
  userId: string;
  quizId: string;
  attemptId: string;
  questionId: string;
  isCorrect: boolean;
}) {
  const quiz = await getQuizForHost({ userId: params.userId, quizId: params.quizId });
  const question = quiz.questions.find((q) => q.id === params.questionId);
  if (!question) throw notFound('question');
  if (question.type !== 'short') {
    throw badRequest('not_short_answer', 'Only short-answer questions can be hand-graded');
  }
  const attempt = await QuizAttempt.findById(params.attemptId);
  if (!attempt) throw notFound('attempt');
  if (String(attempt.quizId) !== params.quizId) throw notFound('attempt');

  const updated = attempt.answers.map((a) =>
    a.questionId === params.questionId ? { ...a, autoCorrect: params.isCorrect, hostGraded: true } : a,
  );
  attempt.answers = updated;
  attempt.score = computeScore(quiz.questions, attempt.answers);
  await attempt.save();
  triggerAnalytics(params.quizId);
  return attempt;
}

// ── Launch-readiness checks ─────────────────────────────────────────────────

/**
 * Returns null if the question is ready to launch, otherwise a human-readable
 * reason. Mirrors the client-side `validateQuestion` so users see the same
 * rules in the editor's inline validation banner that the server enforces
 * here on launch.
 */
function checkLaunchReadiness(question: QuizQuestion): string | null {
  if (question.prompt.trim().length === 0) {
    return 'Every question needs a prompt';
  }
  if (question.type === 'mcq_single') {
    if (question.options.length < 2) return 'MCQ questions need at least two options';
    if (question.options.some((o) => o.text.trim().length === 0)) {
      return 'Every MCQ option needs text';
    }
    const correct = question.options.filter((o) => o.isCorrect).length;
    if (correct !== 1) return 'Single-answer MCQ needs exactly one correct option';
  } else if (question.type === 'mcq_multi') {
    if (question.options.length < 2) return 'MCQ questions need at least two options';
    if (question.options.some((o) => o.text.trim().length === 0)) {
      return 'Every MCQ option needs text';
    }
    const correct = question.options.filter((o) => o.isCorrect).length;
    if (correct < 1) return 'Multi-answer MCQ needs at least one correct option';
  }
  return null;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Returns null for short-answer questions (host grades after); true/false for
 * the auto-graded types. MCQ-multi is all-or-nothing — every correct option
 * picked, no incorrect option picked. Matches the docs/principles guidance to
 * keep scoring simple and visible to participants.
 */
function scoreAnswer(question: QuizQuestion, answer: SubmitAnswerBody): boolean | null {
  if (question.type === 'short') return null;
  if (question.type === 'true_false') {
    return answer.selectedBool === question.correct;
  }
  if (question.type === 'mcq_single') {
    const picked = answer.selectedOptionIds ?? [];
    if (picked.length !== 1) return false;
    const correct = question.options.find((o) => o.isCorrect);
    return Boolean(correct && correct.id === picked[0]);
  }
  // mcq_multi
  const correctIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
  const pickedIds = new Set(answer.selectedOptionIds ?? []);
  if (pickedIds.size !== correctIds.size) return false;
  for (const id of correctIds) if (!pickedIds.has(id)) return false;
  return true;
}

function computeScore(questions: QuizQuestion[], answers: AnswerShape[]): number {
  if (questions.length === 0) return 0;
  let correct = 0;
  let counted = 0;
  for (const q of questions) {
    const a = answers.find((x) => x.questionId === q.id);
    if (!a) continue;
    if (a.autoCorrect === null) continue; // ungraded short — excluded from running total
    counted += 1;
    if (a.autoCorrect) correct += 1;
  }
  if (counted === 0) return 0;
  return correct / questions.length;
}

// ── Redaction ───────────────────────────────────────────────────────────────

export interface RedactedQuiz {
  id: string;
  channelId: string;
  hostUserId: string;
  title: string;
  status: string;
  mode: string | null;
  questions: RedactedQuestion[];
  settings: QuizSettings;
}

type RedactedQuestion =
  | {
      id: string;
      type: 'mcq_single' | 'mcq_multi';
      prompt: string;
      options: { id: string; text: string }[];
    }
  | { id: string; type: 'true_false'; prompt: string }
  | { id: string; type: 'short'; prompt: string };

function redactQuiz(quiz: QuizDoc): RedactedQuiz {
  return {
    id: String(quiz._id),
    channelId: quiz.channelId,
    hostUserId: quiz.hostUserId,
    title: quiz.title,
    status: quiz.status,
    mode: quiz.mode,
    questions: quiz.questions.map(redactQuestion),
    settings: quiz.settings,
  };
}

function redactQuestion(q: QuizQuestion): RedactedQuestion {
  if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
    return {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    };
  }
  if (q.type === 'true_false') {
    return { id: q.id, type: 'true_false', prompt: q.prompt };
  }
  return { id: q.id, type: 'short', prompt: q.prompt };
}
