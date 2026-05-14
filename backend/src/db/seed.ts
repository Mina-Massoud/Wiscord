import { connectDb, disconnectDb } from './connect.js';
import { User } from './models/index.js';

interface SeedUser {
  email: string;
  username: string;
  displayName: string;
}

const USERS: SeedUser[] = [
  { email: 'dev@wiscord.local', username: 'dev', displayName: 'Dev User' },
  { email: 'alice@wiscord.local', username: 'alice', displayName: 'Alice (voice test)' },
  { email: 'bob@wiscord.local', username: 'bob', displayName: 'Bob (voice test)' },
];

/**
 * Dev seed — onboarded users we can sign in as locally without going
 * through the magic-link flow. Idempotent.
 *
 * `dev@wiscord.local` is the default single-user account. `alice` and `bob`
 * exist for two-account voice-channel testing — request a magic link for
 * each email and the dev server prints the verify URL to the console.
 *
 * Run with: npm run db:seed
 */
async function main(): Promise<void> {
  await connectDb();

  for (const u of USERS) {
    const user = await User.findOneAndUpdate(
      { email: u.email },
      {
        $setOnInsert: {
          email: u.email,
          username: u.username,
          displayName: u.displayName,
          onboardedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    console.warn(`[seed] user ready: ${user.email} (${user._id.toString()})`);
  }
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exit(1);
  })
  .finally(() => {
    void disconnectDb().then(() => process.exit(0));
  });
