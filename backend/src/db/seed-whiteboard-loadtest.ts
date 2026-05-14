import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

import { connectDb, disconnectDb } from './connect.js';
import { ChannelWhiteboard, User } from './models/index.js';

/**
 * Demo seeder for the live whiteboard load test.
 *
 *   npm run db:seed:whiteboard-loadtest            — idempotent setup
 *   npm run db:seed:whiteboard-loadtest -- --reset — wipe the persisted
 *                                                    snapshot so the
 *                                                    board starts blank
 *
 * The host (`minamelad232@gmail.com`) and the 50 `load-participant-NN`
 * accounts are upserted in the same shape the quiz loadtest seeder uses,
 * and the demo channelId is shared with the quiz demo so the URL slug
 * stays the same across both labs.
 *
 * What it does:
 *   1. Upsert host user (with `onboardedAt` so the frontend skips the
 *      onboarding wizard).
 *   2. Upsert 50 participants — same emails as the quiz demo so we don't
 *      keep growing the user table.
 *   3. Optionally wipe the persisted `ChannelWhiteboard` row so the
 *      next swarm starts on a blank slate.
 *   4. Write `.whiteboard-loadtest.json` next to the file so the runner
 *      can read host/channel/participant info without re-querying Mongo.
 */

const HOST_EMAIL = 'minamelad232@gmail.com';
const HOST_USERNAME = 'mina';
const HOST_DISPLAY_NAME = 'Mina (Host)';

const PARTICIPANT_COUNT = 50;
const PARTICIPANT_EMAIL = (n: number): string =>
  `load-participant-${String(n).padStart(2, '0')}@wiscord.local`;
const PARTICIPANT_USERNAME = (n: number): string =>
  `participant_${String(n).padStart(2, '0')}`;
const PARTICIPANT_DISPLAY_NAME = (n: number): string =>
  `Participant ${String(n).padStart(2, '0')}`;

// Shared with the quiz loadtest — one bookmark, one demo URL.
export const WHITEBOARD_LOADTEST_CHANNEL_ID = '00000000-0000-4000-8000-000000000042';

interface WhiteboardSeedSummary {
  hostId: string;
  hostEmail: string;
  participantCount: number;
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

async function maybeResetSnapshot(reset: boolean): Promise<void> {
  if (!reset) return;
  const result = await ChannelWhiteboard.deleteOne({
    channelId: WHITEBOARD_LOADTEST_CHANNEL_ID,
  });
  console.warn(
    `[seed] cleared ${result.deletedCount ?? 0} persisted whiteboard rows for channel ${WHITEBOARD_LOADTEST_CHANNEL_ID}`,
  );
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  await connectDb();

  const hostId = await upsertHost();
  console.warn(`[seed] host ready: ${HOST_EMAIL} (${hostId})`);

  const participantIds = await upsertParticipants();
  console.warn(`[seed] participants ready: ${participantIds.length} accounts`);

  await maybeResetSnapshot(reset);

  const summary: WhiteboardSeedSummary = {
    hostId,
    hostEmail: HOST_EMAIL,
    participantCount: participantIds.length,
    channelId: WHITEBOARD_LOADTEST_CHANNEL_ID,
    dashboardPath: `/app/labs/whiteboard/${WHITEBOARD_LOADTEST_CHANNEL_ID}`,
    resetApplied: reset,
  };

  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const out = path.join(here, '.whiteboard-loadtest.json');
  await fs.writeFile(out, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.warn('');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('  Whiteboard load-test demo is set up.');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn(`  Host          : ${HOST_EMAIL}`);
  console.warn(`  Participants  : ${PARTICIPANT_COUNT}`);
  console.warn(`  Channel id    : ${WHITEBOARD_LOADTEST_CHANNEL_ID}`);
  console.warn(`  Reset board   : ${reset ? 'yes' : 'no (pass --reset to clear)'}`);
  console.warn('');
  console.warn('  Next steps:');
  console.warn(`    1. Sign in as ${HOST_EMAIL} in the frontend.`);
  console.warn(`    2. Open: http://localhost:5173${summary.dashboardPath}`);
  console.warn('    3. Run:  npm run whiteboard:loadtest');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((err) => {
    console.error('[seed] whiteboard load-test seeder failed', err);
    process.exit(1);
  })
  .finally(() => {
    void disconnectDb().then(() => process.exit(0));
  });
