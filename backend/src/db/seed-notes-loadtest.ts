import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

import { connectDb, disconnectDb } from './connect.js';
import { ChannelNotes, User } from './models/index.js';

/**
 * Demo seeder for the live notes load test.
 *
 *   npm run db:seed:notes-loadtest            — idempotent setup
 *   npm run db:seed:notes-loadtest -- --reset — wipe the persisted Yjs
 *                                               doc so the page starts
 *                                               blank for the next run
 *
 * Reuses the same `load-participant-NN` accounts the whiteboard / quiz
 * seeders set up so we don't keep growing the user table. The host
 * (`minamelad232@gmail.com`) is upserted with `onboardedAt` so the
 * frontend skips the wizard.
 *
 * What it does:
 *   1. Upsert host user.
 *   2. Upsert 50 participants — same emails as the other demos.
 *   3. Optionally wipe the persisted `ChannelNotes` row so the next run
 *      starts on a blank page.
 *   4. Write `.notes-loadtest.json` next to the file so the runner can
 *      read host/channel/participant info without re-querying Mongo.
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

// Distinct from the whiteboard demo so the two pages don't share a
// document and bleed state across labs.
export const NOTES_LOADTEST_CHANNEL_ID = '00000000-0000-4000-8000-000000000043';

interface NotesSeedSummary {
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

async function maybeResetDoc(reset: boolean): Promise<void> {
  if (!reset) return;
  const result = await ChannelNotes.deleteOne({
    channelId: NOTES_LOADTEST_CHANNEL_ID,
  });
  console.warn(
    `[seed] cleared ${result.deletedCount ?? 0} persisted notes rows for channel ${NOTES_LOADTEST_CHANNEL_ID}`,
  );
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  await connectDb();

  const hostId = await upsertHost();
  console.warn(`[seed] host ready: ${HOST_EMAIL} (${hostId})`);

  const participantIds = await upsertParticipants();
  console.warn(`[seed] participants ready: ${participantIds.length} accounts`);

  await maybeResetDoc(reset);

  const summary: NotesSeedSummary = {
    hostId,
    hostEmail: HOST_EMAIL,
    participantCount: participantIds.length,
    channelId: NOTES_LOADTEST_CHANNEL_ID,
    dashboardPath: `/app/labs/notes/${NOTES_LOADTEST_CHANNEL_ID}`,
    resetApplied: reset,
  };

  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const out = path.join(here, '.notes-loadtest.json');
  await fs.writeFile(out, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.warn('');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('  Notes load-test demo is set up.');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn(`  Host          : ${HOST_EMAIL}`);
  console.warn(`  Participants  : ${PARTICIPANT_COUNT}`);
  console.warn(`  Channel id    : ${NOTES_LOADTEST_CHANNEL_ID}`);
  console.warn(`  Reset doc     : ${reset ? 'yes' : 'no (pass --reset to clear)'}`);
  console.warn('');
  console.warn('  Next steps:');
  console.warn(`    1. Sign in as ${HOST_EMAIL} in the frontend.`);
  console.warn(`    2. Open: http://localhost:5173${summary.dashboardPath}`);
  console.warn('    3. Run:  npm run notes:loadtest');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((err) => {
    console.error('[seed] notes load-test seeder failed', err);
    process.exit(1);
  })
  .finally(() => {
    void disconnectDb().then(() => process.exit(0));
  });
