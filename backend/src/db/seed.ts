import { connectDb, disconnectDb } from './connect.js';
import { User } from './models/index.js';
import { hashPassword } from '../lib/password.js';

interface SeedUser {
  email: string;
  username: string;
  displayName: string;
}

// Shared password for every seeded account — local dev only.
const SEED_PASSWORD = 'password123';

const USERS: SeedUser[] = [
  { email: 'dev@wiscord.local', username: 'dev', displayName: 'Dev User' },
  { email: 'alice@wiscord.local', username: 'alice', displayName: 'Alice (voice test)' },
  { email: 'bob@wiscord.local', username: 'bob', displayName: 'Bob (voice test)' },
];

/**
 * Dev seed — onboarded users we can sign in as locally. Idempotent.
 *
 * `dev@wiscord.local` is the default single-user account. `alice` and `bob`
 * exist for two-account voice-channel testing. Every account shares the
 * password `password123` — sign in at /sign-in with the email + that password.
 *
 * Run with: npm run db:seed
 */
async function main(): Promise<void> {
  await connectDb();

  const passwordHash = await hashPassword(SEED_PASSWORD);

  for (const u of USERS) {
    const user = await User.findOneAndUpdate(
      { email: u.email },
      {
        $setOnInsert: {
          email: u.email,
          username: u.username,
          displayName: u.displayName,
          passwordHash,
          onboardedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    console.warn(`[seed] user ready: ${user.email} (${user._id.toString()})`);
  }

  console.warn(`[seed] sign in with any of the above emails + password "${SEED_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exit(1);
  })
  .finally(() => {
    void disconnectDb().then(() => process.exit(0));
  });
