import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

import { connectDb, disconnectDb } from './connect.js';
import { Quiz, QuizAttempt, User } from './models/index.js';
import { signSessionToken } from '../lib/jwt.js';
import { SESSION_COOKIE } from '../lib/cookies.js';
import {
  HR_QUIZ_QUESTIONS,
} from './seed-content/hr-interview-quiz.js';
import type { QuizQuestion } from '../modules/quiz/schemas.js';

/**
 * Load runner — 50 fake users solve the seeded HR quiz over real HTTP so the
 * full pipeline (Express → Mongo → analytics-store → Socket.IO → dashboard)
 * is exercised end-to-end.
 *
 *   npm run quiz:loadtest                  — default settings
 *   npm run quiz:loadtest -- --concurrency=10 --ramp=5 --bias=0.7
 *
 * Flags:
 *   --concurrency=N   max participants in flight at once (default 10)
 *   --ramp=N          spread participant start times across N seconds (default 5)
 *   --bias=F          probability each answer is correct (0..1, default 0.7)
 *   --api=URL         backend base URL (default http://localhost:3001)
 *
 * Prerequisites:
 *   - `npm run dev` is running (backend on :3001)
 *   - `npm run db:seed:loadtest` has been run (creates .loadtest.json)
 *
 * The runner never modifies DB directly — every action is a real HTTP call so
 * the analytics emitter fires for each answer, the same way it would in
 * production traffic.
 */

interface SeedSummary {
  hostId: string;
  hostEmail: string;
  participantCount: number;
  quizId: string;
  channelId: string;
}

interface RunnerOptions {
  apiUrl: string;
  concurrency: number;
  rampSeconds: number;
  correctnessBias: number;
}

interface ParticipantResult {
  index: number;
  userId: string;
  correct: number;
  total: number;
  elapsedMs: number;
  failed: boolean;
  errorMessage?: string;
}

function parseArgs(): RunnerOptions {
  const argv = process.argv.slice(2);
  const get = (flag: string, fallback: string): string => {
    const match = argv.find((a) => a.startsWith(`${flag}=`));
    return match ? match.slice(flag.length + 1) : fallback;
  };
  return {
    apiUrl: get('--api', 'http://localhost:3001').replace(/\/$/, ''),
    concurrency: Number(get('--concurrency', '10')),
    rampSeconds: Number(get('--ramp', '5')),
    correctnessBias: Number(get('--bias', '0.7')),
  };
}

async function readSeedSummary(): Promise<SeedSummary> {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const file = path.join(here, '.loadtest.json');
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    throw new Error(
      `Couldn't find ${file}. Run \`npm run db:seed:loadtest\` first.`,
    );
  }
  return JSON.parse(raw) as SeedSummary;
}

async function ensureBackendUp(apiUrl: string): Promise<void> {
  try {
    const res = await fetch(`${apiUrl}/health`, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`/health responded with ${res.status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Backend not reachable at ${apiUrl}: ${msg}\n` +
        `Start it with \`npm run dev\` in another terminal first.`,
    );
  }
}

interface Participant {
  index: number;
  userId: string;
  email: string;
  cookie: string;
}

/**
 * Reset the quiz to an open state and clear any prior attempts. The host
 * wrapping the quiz mid-demo is a normal workflow — re-running the loadtest
 * after that should "just work", so we flip status back and wipe stale
 * attempts (otherwise prior submitted attempts would block re-answering).
 * The load-test quiz is dedicated demo data, so this only ever touches
 * loadtest rows.
 */
async function ensureQuizReady(quizId: string): Promise<void> {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new Error(`quiz ${quizId} not found — run \`npm run db:seed:loadtest\` first`);
  }

  if (quiz.status !== 'open' && quiz.status !== 'live') {
    console.warn(`[loadtest] quiz was "${quiz.status}" — reopening as async for the run`);
    quiz.status = 'open';
    quiz.mode = quiz.mode ?? 'async';
    quiz.closedAt = null;
    quiz.liveState = null;
    await quiz.save();
  }

  const cleared = await QuizAttempt.deleteMany({ quizId });
  if (cleared.deletedCount && cleared.deletedCount > 0) {
    console.warn(`[loadtest] cleared ${cleared.deletedCount} prior attempts for a fresh run`);
  }
}

async function buildParticipants(summary: SeedSummary): Promise<Participant[]> {
  // Pull every load-test participant deterministically by email pattern so the
  // runner doesn't need to know the user ids up front.
  const users = await User.find({
    email: { $regex: /^load-participant-\d{2}@wiscord\.local$/ },
  }).sort({ email: 1 });

  if (users.length === 0) {
    throw new Error(
      `Found 0 load-test participants in DB. Run \`npm run db:seed:loadtest\` first.`,
    );
  }
  if (users.length !== summary.participantCount) {
    console.warn(
      `[loadtest] expected ${summary.participantCount} participants, found ${users.length} — continuing with what's there.`,
    );
  }

  const result: Participant[] = [];
  for (let i = 0; i < users.length; i += 1) {
    const u = users[i];
    if (!u) continue;
    const userId = String(u._id);
    const token = await signSessionToken(userId);
    result.push({
      index: i + 1,
      userId,
      email: u.email,
      cookie: `${SESSION_COOKIE}=${token}`,
    });
  }
  return result;
}

/**
 * Pick an answer body for a question. With probability `bias`, picks a
 * correct option; otherwise picks an incorrect one. Falls back to a random
 * pick if the question has no clearly correct option (shouldn't happen for
 * the HR quiz, but defensive).
 */
function pickAnswer(
  question: QuizQuestion,
  bias: number,
): { selectedOptionIds?: string[]; selectedBool?: boolean; text?: string } {
  const wantCorrect = Math.random() < bias;

  if (question.type === 'true_false') {
    const value = wantCorrect ? question.correct : !question.correct;
    return { selectedBool: value };
  }

  if (question.type === 'mcq_single') {
    const correct = question.options.filter((o) => o.isCorrect);
    const incorrect = question.options.filter((o) => !o.isCorrect);
    const pool = wantCorrect && correct.length > 0 ? correct : incorrect.length > 0 ? incorrect : correct;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { selectedOptionIds: pick ? [pick.id] : [] };
  }

  if (question.type === 'mcq_multi') {
    const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
    if (wantCorrect && correctIds.length > 0) {
      return { selectedOptionIds: correctIds };
    }
    // Wrong: drop one correct or add one wrong
    const wrong = question.options.find((o) => !o.isCorrect);
    if (correctIds.length > 1) return { selectedOptionIds: correctIds.slice(1) };
    if (wrong) return { selectedOptionIds: [...correctIds, wrong.id] };
    return { selectedOptionIds: [] };
  }

  // short — bias controls whether we send something close to the reference
  return { text: wantCorrect ? (question.referenceAnswer ?? 'thoughtful answer') : 'idk' };
}

function jitter(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function postJson(
  url: string,
  cookie: string,
  body: unknown,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function patchJson(
  url: string,
  cookie: string,
  body: unknown,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

/**
 * Drive one participant through the full quiz. Returns timing + accuracy
 * stats so the final tally is interesting.
 */
async function runParticipant(
  participant: Participant,
  summary: SeedSummary,
  options: RunnerOptions,
): Promise<ParticipantResult> {
  const startedAt = Date.now();
  const base = `${options.apiUrl}/quiz/${summary.quizId}`;

  try {
    // Start (or recover) attempt — idempotent on the server.
    const startRes = await postJson(`${base}/attempts`, participant.cookie, undefined);
    if (startRes.status !== 201 && startRes.status !== 200) {
      throw new Error(
        `start attempt failed (${startRes.status}): ${JSON.stringify(startRes.data)}`,
      );
    }
    const attempt = extractAttempt(startRes.data);
    if (!attempt) throw new Error('start attempt: no attempt in response');

    let correct = 0;

    // Walk the questions in a randomized order so the live dashboard's
    // per-question fill-rate looks organic rather than every participant
    // hitting q01 at the same instant.
    const order = [...HR_QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);

    for (const question of order) {
      await jitter(200, 1500);
      const answer = pickAnswer(question, options.correctnessBias);
      const body = { questionId: question.id, ...answer };
      const res = await patchJson(`${base}/attempts/${attempt.id}`, participant.cookie, body);
      if (res.status !== 200) {
        throw new Error(
          `submit answer for ${question.id} failed (${res.status}): ${JSON.stringify(res.data)}`,
        );
      }
      // Quick local correctness check for the result line (the server is the
      // real source of truth; this is just for the runner's stdout summary).
      if (isLocallyCorrect(question, answer)) correct += 1;
    }

    const finalize = await postJson(
      `${base}/attempts/${attempt.id}/submit`,
      participant.cookie,
      undefined,
    );
    if (finalize.status !== 200) {
      throw new Error(
        `finalize failed (${finalize.status}): ${JSON.stringify(finalize.data)}`,
      );
    }

    return {
      index: participant.index,
      userId: participant.userId,
      correct,
      total: HR_QUIZ_QUESTIONS.length,
      elapsedMs: Date.now() - startedAt,
      failed: false,
    };
  } catch (err) {
    return {
      index: participant.index,
      userId: participant.userId,
      correct: 0,
      total: HR_QUIZ_QUESTIONS.length,
      elapsedMs: Date.now() - startedAt,
      failed: true,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

interface AttemptShape {
  id: string;
}

function extractAttempt(data: unknown): AttemptShape | null {
  if (
    data &&
    typeof data === 'object' &&
    'data' in data &&
    typeof (data as { data: unknown }).data === 'object' &&
    (data as { data: unknown }).data !== null
  ) {
    const inner = (data as { data: { attempt?: { id?: unknown } } }).data;
    if (inner.attempt && typeof inner.attempt.id === 'string') {
      return { id: inner.attempt.id };
    }
  }
  return null;
}

function isLocallyCorrect(
  q: QuizQuestion,
  answer: { selectedOptionIds?: string[]; selectedBool?: boolean; text?: string },
): boolean {
  if (q.type === 'true_false') return answer.selectedBool === q.correct;
  if (q.type === 'mcq_single') {
    const picked = answer.selectedOptionIds?.[0];
    return q.options.some((o) => o.isCorrect && o.id === picked);
  }
  if (q.type === 'mcq_multi') {
    const want = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
    const got = new Set(answer.selectedOptionIds ?? []);
    if (want.size !== got.size) return false;
    for (const id of want) if (!got.has(id)) return false;
    return true;
  }
  return false; // short — host-graded
}

/**
 * Run an async worker pool with `concurrency` workers, ramping starts across
 * `rampSeconds` so the dashboard sees a smooth curve.
 */
async function runWithPool(
  participants: Participant[],
  options: RunnerOptions,
  summary: SeedSummary,
): Promise<ParticipantResult[]> {
  const queue = [...participants];
  const results: ParticipantResult[] = [];
  const rampMsPerStart = participants.length > 0 ? (options.rampSeconds * 1000) / participants.length : 0;
  const rampStartAt = Date.now();

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      // Stagger each start so the dashboard's "Cooking now" curve doesn't
      // jump from 0 → 50 in one frame.
      const targetStartAt = rampStartAt + (next.index - 1) * rampMsPerStart;
      const waitFor = targetStartAt - Date.now();
      if (waitFor > 0) await new Promise((r) => setTimeout(r, waitFor));

      console.warn(`[loadtest] ▶ participant ${next.index} starting (${next.email})`);
      const result = await runParticipant(next, summary, options);
      results.push(result);

      if (result.failed) {
        console.warn(
          `[loadtest] ✗ participant ${result.index} failed in ${result.elapsedMs}ms — ${result.errorMessage}`,
        );
      } else {
        console.warn(
          `[loadtest] ✓ participant ${result.index} cooked (${result.correct}/${result.total} in ${result.elapsedMs}ms)`,
        );
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, options.concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  const options = parseArgs();
  if (!Number.isFinite(options.concurrency) || options.concurrency <= 0) {
    throw new Error('--concurrency must be a positive number');
  }
  if (!Number.isFinite(options.correctnessBias) || options.correctnessBias < 0 || options.correctnessBias > 1) {
    throw new Error('--bias must be between 0 and 1');
  }

  const summary = await readSeedSummary();

  console.warn('[loadtest] config:', {
    apiUrl: options.apiUrl,
    concurrency: options.concurrency,
    rampSeconds: options.rampSeconds,
    correctnessBias: options.correctnessBias,
    quizId: summary.quizId,
    channelId: summary.channelId,
  });

  await ensureBackendUp(options.apiUrl);

  await connectDb();
  await ensureQuizReady(summary.quizId);
  const participants = await buildParticipants(summary);
  await disconnectDb();

  console.warn(`[loadtest] minted ${participants.length} session tokens — kicking off`);

  const startedAt = Date.now();
  const results = await runWithPool(participants, options, summary);
  const elapsed = Date.now() - startedAt;

  // Final tally
  const succeeded = results.filter((r) => !r.failed);
  const failed = results.filter((r) => r.failed);
  const avgCorrect =
    succeeded.length === 0
      ? 0
      : succeeded.reduce((sum, r) => sum + r.correct, 0) / succeeded.length;

  console.warn('');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('  Load test done.');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn(`  Total wall time : ${(elapsed / 1000).toFixed(1)}s`);
  console.warn(`  Succeeded       : ${succeeded.length} / ${results.length}`);
  console.warn(`  Failed          : ${failed.length}`);
  console.warn(
    `  Avg score       : ${avgCorrect.toFixed(1)}/${HR_QUIZ_QUESTIONS.length} (${Math.round(
      (avgCorrect / HR_QUIZ_QUESTIONS.length) * 100,
    )}%)`,
  );
  console.warn(
    `  Dashboard       : http://localhost:5173/app/labs/quiz/${summary.channelId}?quiz=${summary.quizId}`,
  );
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((err) => {
    console.error('[loadtest] failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
