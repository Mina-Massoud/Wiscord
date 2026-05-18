/**
 * One-shot maintenance script — clear `billing.stripeCustomerId` from
 * every user. Use after swapping Stripe accounts / API keys in dev so
 * the next checkout / portal call creates a fresh customer in the new
 * account instead of failing with `No such customer: cus_…`.
 *
 * Safe to run repeatedly in dev — it's idempotent (a user with no
 * cached id already gets nothing un-set; Mongo just reports
 * `modifiedCount: 0`).
 *
 * NEVER run this against production. It strips the link between every
 * user and their real Stripe customer record, breaking webhook routing
 * (we look users up BY `billing.stripeCustomerId`), and forcing every
 * subsequent Portal session to hit the slower Stripe metadata-search
 * recovery path. Any user whose Stripe customer was also deleted in
 * the same window loses access entirely.
 *
 * Two safeguards, both required:
 *   1. Refuse outright when NODE_ENV=production
 *   2. Require an explicit `--force` flag in any environment, so a
 *      copy-pasted `npx tsx ...` from chat can't wipe a dev DB by
 *      accident
 *
 * Usage:
 *   npx tsx scripts/clear-stale-stripe-customers.ts --force
 */

import { connectDb, disconnectDb } from '../src/db/connect.js';
import { User } from '../src/db/models/index.js';
import { logger } from '../src/lib/logger.js';

function abort(message: string): never {
  // Use console.error rather than the logger so a misconfigured logger
  // (e.g. a pino transport that swallows fatals during dev) can never
  // hide a refused-to-run line.
  console.error(`FATAL: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    abort(
      `refusing to run in production (NODE_ENV=${nodeEnv}). ` +
        'This script wipes every user\'s Stripe customer link.',
    );
  }
  if (!process.argv.includes('--force')) {
    abort(
      'this script wipes EVERY user\'s billing.stripeCustomerId.\n' +
        '  Pass --force to confirm. Double-check MONGODB_URI is your dev DB:\n' +
        `    MONGODB_URI=${process.env.MONGODB_URI ?? '(unset)'}`,
    );
  }

  await connectDb();
  const result = await User.updateMany(
    { 'billing.stripeCustomerId': { $exists: true, $ne: null } },
    { $unset: { 'billing.stripeCustomerId': '' } },
  );
  logger.info(
    {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    },
    'cleared stripe customer ids',
  );
  await disconnectDb();
}

main().catch((err) => {
  logger.error({ err }, 'clear-stale-stripe-customers failed');
  process.exit(1);
});
