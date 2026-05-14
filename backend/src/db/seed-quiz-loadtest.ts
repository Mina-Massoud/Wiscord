import { connectDb, disconnectDb } from './connect.js';
import { Quiz, QuizAttempt, User } from './models/index.js';
import { launchQuiz } from '../modules/quiz/service.js';
import { DEFAULT_QUIZ_SETTINGS } from '../modules/quiz/schemas.js';
import { HR_QUIZ_QUESTIONS, HR_QUIZ_TITLE } from './seed-content/hr-interview-quiz.js';

/**
 * Demo seeder for the live-analytics load test.
 *
 *   npm run db:seed:loadtest            — idempotent setup (run once)
 *   npm run db:seed:loadtest -- --reset — wipe attempts so the dashboard
 *                                         starts at zero again
 *
 * What it creates (all upserts — re-runs are safe):
 *   1. Host user: minamelad232@gmail.com (username "mina"). Already onboarded
 *      so the frontend doesn't push them through onboarding.
 *   2. 50 participant users: load-participant-NN@wiscord.local.
 *   3. One quiz: 30-question HR interview screen, owned by the host, on a
 *      stable demo channel id, launched in async mode.
 *
 * Why these names: emails under `wiscord.local` so they can't collide with
 * any real address, and the demo participants are easy to spot in any user
 * list. The host's email is the one the operator already uses to sign in.
 *
 * Channel ID is hardcoded so re-runs always land on the same lab URL — the
 * dashboard link printed at the end stays stable across re-seeds.
 */

const HOST_EMAIL = 'minamelad232@gmail.com';
const HOST_USERNAME = 'mina';
const HOST_DISPLAY_NAME = 'Mina (Host)';

const PARTICIPANT_COUNT = 50;
const PARTICIPANT_EMAIL = (n: number): string =>
  `load-participant-${String(n).padStart(2, '0')}@wiscord.local`;
const PARTICIPANT_USERNAME = (n: number): string => `participant_${String(n).padStart(2, '0')}`;
const PARTICIPANT_DISPLAY_NAME = (n: number): string => `Participant ${String(n).padStart(2, '0')}`;

// A valid v4 UUID — fixed so the demo URL doesn't change every run.
export const LOADTEST_CHANNEL_ID = '00000000-0000-4000-8000-000000000042';

interface SeedSummary {
  hostId: string;
  hostEmail: string;
  participantCount: number;
  quizId: string;
  channelId: string;
  dashboardPath: string;
  resetApplied: boolean;
}

async function upsertHost(): Promise<string> {
  const host = await User.findOneAndUpdate(
    { email: HOST_EMAIL },
    {
      $setOnInsert: {
        email: HOST_EMAIL,
        username: HOST_USERNAME,
        displayName: HOST_DISPLAY_NAME,
        onboardedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!host) throw new Error('host upsert returned null');
  return String(host._id);
}

async function upsertParticipants(): Promise<string[]> {
  const ids: string[] = [];
  for (let n = 1; n <= PARTICIPANT_COUNT; n += 1) {
    const email = PARTICIPANT_EMAIL(n);
    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          username: PARTICIPANT_USERNAME(n),
          displayName: PARTICIPANT_DISPLAY_NAME(n),
          onboardedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    if (!user) throw new Error(`participant ${n} upsert returned null`);
    ids.push(String(user._id));
  }
  return ids;
}

async function upsertQuiz(hostId: string, reset: boolean): Promise<string> {
  // Find by stable identity (host + channel + title) so re-runs update in
  // place. Always rewrite the question set from the source-of-truth content
  // file so edits to the content propagate without manual cleanup.
  let quiz = await Quiz.findOne({
    hostUserId: hostId,
    channelId: LOADTEST_CHANNEL_ID,
    title: HR_QUIZ_TITLE,
  });

  if (!quiz) {
    quiz = await Quiz.create({
      channelId: LOADTEST_CHANNEL_ID,
      hostUserId: hostId,
      title: HR_QUIZ_TITLE,
      status: 'draft',
      mode: null,
      questions: HR_QUIZ_QUESTIONS,
      settings: { ...DEFAULT_QUIZ_SETTINGS, timePerQuestionSec: null },
    });
  } else {
    quiz.questions = HR_QUIZ_QUESTIONS;
    if (reset) {
      // Roll back to a fresh draft so launchQuiz below re-launches cleanly
      // and the analytics store starts from zero.
      quiz.status = 'draft';
      quiz.mode = null;
      quiz.liveState = null;
      quiz.closedAt = null;
    }
    await quiz.save();
  }

  if (quiz.status === 'draft') {
    // Drive through the real service path so the launch-readiness checks
    // (non-empty prompts, correct counts, etc.) run against the seed content.
    await launchQuiz({ userId: hostId, quizId: String(quiz._id), mode: 'async' });
  }

  return String(quiz._id);
}

async function clearAttemptsIfRequested(quizId: string, reset: boolean): Promise<void> {
  if (!reset) return;
  const res = await QuizAttempt.deleteMany({ quizId });
  console.warn(`[seed] cleared ${res.deletedCount ?? 0} prior attempts on quiz ${quizId}`);
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  await connectDb();

  const hostId = await upsertHost();
  console.warn(`[seed] host ready: ${HOST_EMAIL} (${hostId})`);

  const participantIds = await upsertParticipants();
  console.warn(`[seed] participants ready: ${participantIds.length} accounts`);

  const quizId = await upsertQuiz(hostId, reset);
  await clearAttemptsIfRequested(quizId, reset);

  const summary: SeedSummary = {
    hostId,
    hostEmail: HOST_EMAIL,
    participantCount: participantIds.length,
    quizId,
    channelId: LOADTEST_CHANNEL_ID,
    dashboardPath: `/app/labs/quiz/${LOADTEST_CHANNEL_ID}?quiz=${quizId}`,
    resetApplied: reset,
  };

  // The summary is also written to a small file so the load runner can pick
  // it up without re-querying Mongo for the quizId.
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const out = path.join(here, '.loadtest.json');
  await fs.writeFile(out, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.warn('');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('  Load-test demo is set up.');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn(`  Host           : ${HOST_EMAIL}`);
  console.warn(`  Participants   : ${PARTICIPANT_COUNT}`);
  console.warn(`  Quiz id        : ${quizId}`);
  console.warn(`  Channel id     : ${LOADTEST_CHANNEL_ID}`);
  console.warn(`  Reset attempts : ${reset ? 'yes' : 'no (pass --reset to clear)'}`);
  console.warn('');
  console.warn('  Next steps:');
  console.warn(`    1. Sign in as ${HOST_EMAIL} in the frontend.`);
  console.warn(`    2. Open: http://localhost:5173${summary.dashboardPath}`);
  console.warn('    3. Run:  npm run quiz:loadtest');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((err) => {
    console.error('[seed] load-test seeder failed', err);
    process.exit(1);
  })
  .finally(() => {
    void disconnectDb().then(() => process.exit(0));
  });
