import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  attemptIdParam,
  channelIdQuery,
  createQuizBody,
  gradeAnswerBody,
  launchQuizBody,
  quizIdParam,
  submitAnswerBody,
  updateQuizBody,
} from './schemas.js';
import {
  closeQuiz,
  createQuiz,
  deleteQuiz,
  finalizeAttempt,
  getQuizForHost,
  getQuizForParticipant,
  gradeAnswer,
  launchQuiz,
  listAttempts,
  listQuizzesForChannel,
  listQuizzesForHost,
  startAttempt,
  submitAnswer,
  updateQuiz,
} from './service.js';
import { quizAnalytics } from './analytics-store.js';

export const quizRouter: Router = Router();

/**
 * GET /quiz?channelId=…
 * Lists quizzes for a channel (host edit shape — host data only included for
 * quizzes the user actually owns; other rows are returned with the same
 * payload because the page surface only renders the sidebar's title + status,
 * not anything sensitive).
 */
quizRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdQuery.parse(req.query);
    const quizzes = await listQuizzesForChannel({ userId: req.userId!, channelId });
    res.json(ok({ quizzes }));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /quiz/mine
 * Lists every quiz the caller hosts across all channels. Backs the labs
 * index page (`/app/labs/quiz`), which groups the result by channelId.
 * Must be declared before `GET /:id` — otherwise the dynamic route would
 * intercept `mine` and 400 on the ObjectId regex.
 */
quizRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const quizzes = await listQuizzesForHost({ userId: req.userId! });
    res.json(ok({ quizzes }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quiz
 * Creates a draft quiz. Body: { channelId, title }.
 */
quizRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = createQuizBody.parse(req.body);
    const quiz = await createQuiz({
      userId: req.userId!,
      channelId: body.channelId,
      title: body.title,
    });
    res.status(201).json(ok({ quiz }));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /quiz/:id
 * Returns the host edit shape if the caller is the host, otherwise the
 * participant-redacted shape.
 */
quizRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = quizIdParam.parse(req.params);
    // Optimistic host fetch — falls through to participant view on 403.
    try {
      const quiz = await getQuizForHost({ userId: req.userId!, quizId: id });
      res.json(ok({ role: 'host', quiz }));
      return;
    } catch (hostErr) {
      // Re-throw anything that isn't a forbidden — notFound, validation errors, etc.
      if (
        !(hostErr instanceof Error) ||
        !('code' in hostErr) ||
        (hostErr as { code: string }).code !== 'forbidden'
      ) {
        throw hostErr;
      }
    }
    const quiz = await getQuizForParticipant({ userId: req.userId!, quizId: id });
    res.json(ok({ role: 'participant', quiz }));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /quiz/:id
 * Update title / questions / settings. Allowed only while status === 'draft'.
 */
quizRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = quizIdParam.parse(req.params);
    const patch = updateQuizBody.parse(req.body);
    const quiz = await updateQuiz({ userId: req.userId!, quizId: id, patch });
    res.json(ok({ quiz }));
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /quiz/:id
 * Hard delete (drafts only — closed quizzes are kept for results).
 */
quizRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = quizIdParam.parse(req.params);
    await deleteQuiz({ userId: req.userId!, quizId: id });
    res.json(ok({ deleted: true }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quiz/:id/launch
 * Body: { mode: 'live' | 'async' }. Flips status from draft to live or open.
 */
quizRouter.post('/:id/launch', requireAuth, async (req, res, next) => {
  try {
    const { id } = quizIdParam.parse(req.params);
    const body = launchQuizBody.parse(req.body);
    const quiz = await launchQuiz({ userId: req.userId!, quizId: id, mode: body.mode });
    res.json(ok({ quiz }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quiz/:id/close
 * Closes a live or async quiz. Idempotent.
 */
quizRouter.post('/:id/close', requireAuth, async (req, res, next) => {
  try {
    const { id } = quizIdParam.parse(req.params);
    const quiz = await closeQuiz({ userId: req.userId!, quizId: id });
    res.json(ok({ quiz }));
  } catch (err) {
    next(err);
  }
});

// ── Attempts ────────────────────────────────────────────────────────────────

/**
 * POST /quiz/:id/attempts
 * Start (or recover) the caller's attempt for a quiz. Idempotent.
 */
quizRouter.post('/:id/attempts', requireAuth, async (req, res, next) => {
  try {
    const { id } = quizIdParam.parse(req.params);
    const attempt = await startAttempt({ userId: req.userId!, quizId: id });
    res.status(201).json(ok({ attempt }));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /quiz/:id/attempts/:attemptId
 * Submit (or replace) the caller's answer for a single question.
 */
quizRouter.patch('/:id/attempts/:attemptId', requireAuth, async (req, res, next) => {
  try {
    const { id, attemptId } = attemptIdParam.parse(req.params);
    const body = submitAnswerBody.parse(req.body);
    const attempt = await submitAnswer({
      userId: req.userId!,
      quizId: id,
      attemptId,
      answer: body,
    });
    res.json(ok({ attempt }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quiz/:id/attempts/:attemptId/submit
 * Async-only: participant finalizes their attempt.
 */
quizRouter.post('/:id/attempts/:attemptId/submit', requireAuth, async (req, res, next) => {
  try {
    const { id, attemptId } = attemptIdParam.parse(req.params);
    const attempt = await finalizeAttempt({
      userId: req.userId!,
      quizId: id,
      attemptId,
    });
    res.json(ok({ attempt }));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /quiz/:id/attempts
 * Host-only: list all attempts for a quiz.
 */
quizRouter.get('/:id/attempts', requireAuth, async (req, res, next) => {
  try {
    const { id } = quizIdParam.parse(req.params);
    const attempts = await listAttempts({ userId: req.userId!, quizId: id });
    res.json(ok({ attempts }));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /quiz/:id/analytics
 * Host-only: initial analytics snapshot. Computed on demand if the in-memory
 * store hasn't cached it yet. Socket subscription handles live updates.
 */
quizRouter.get('/:id/analytics', requireAuth, async (req, res, next) => {
  try {
    const { id } = quizIdParam.parse(req.params);
    // Throws forbidden / notFound if the caller isn't the host.
    await getQuizForHost({ userId: req.userId!, quizId: id });
    const snapshot = await quizAnalytics.getOrCompute(id);
    res.json(ok({ analytics: snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /quiz/:id/attempts/:attemptId/grade
 * Host-only: grade a short-answer question on a participant's attempt.
 */
quizRouter.patch('/:id/attempts/:attemptId/grade', requireAuth, async (req, res, next) => {
  try {
    const { id, attemptId } = attemptIdParam.parse(req.params);
    const body = gradeAnswerBody.parse(req.body);
    const attempt = await gradeAnswer({
      userId: req.userId!,
      quizId: id,
      attemptId,
      questionId: body.questionId,
      isCorrect: body.isCorrect,
    });
    res.json(ok({ attempt }));
  } catch (err) {
    next(err);
  }
});
