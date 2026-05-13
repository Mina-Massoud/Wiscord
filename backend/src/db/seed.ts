import { connectDb, disconnectDb } from './connect.js';
import { User } from './models/index.js';

/**
 * Dev seed — one onboarded user we can sign in as locally without going
 * through the magic-link flow. Idempotent.
 * Run with: npm run db:seed
 */
async function main(): Promise<void> {
  await connectDb();

  const user = await User.findOneAndUpdate(
    { email: 'dev@wiscord.local' },
    {
      $setOnInsert: {
        email: 'dev@wiscord.local',
        username: 'dev',
        displayName: 'Dev User',
        onboardedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  console.warn(`[seed] user ready: ${user.email} (${user._id.toString()})`);
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exit(1);
  })
  .finally(() => {
    void disconnectDb().then(() => process.exit(0));
  });
