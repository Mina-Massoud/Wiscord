/* eslint-disable no-console */
import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import inputLib from 'input';

interface InputPrompt {
  text(prompt: string): Promise<string>;
}
// `input` is a tiny stdin prompt lib with no shipped types — narrow at the import boundary.
const ask: InputPrompt = inputLib as InputPrompt;

/**
 * One-time interactive script: logs the storage account into Telegram and
 * prints a session string the server can use forever (until you sign out
 * or revoke the session from the Telegram app).
 *
 * Run: `npm run storage:login`
 * Prerequisite: TELEGRAM_API_ID + TELEGRAM_API_HASH in backend/.env
 *   (get them from https://my.telegram.org/apps after signing in with the
 *    Telegram account you want to use as the storage account).
 *
 * What it asks for:
 *   1. Phone number (E.164, e.g. +14155551234) — the account's number
 *   2. The Telegram-app login code Telegram sends you
 *   3. Your 2FA password if you have one enabled (blank otherwise)
 *
 * On success it prints a long string. Paste it into .env as
 * TELEGRAM_SESSION_STRING. Then `npm run dev` and the storage module works.
 */
async function main(): Promise<void> {
  const apiIdRaw = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiIdRaw || !apiHash) {
    console.error(
      '✗ TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in backend/.env first.',
    );
    console.error('  Register an app at https://my.telegram.org/apps to get them.');
    process.exit(1);
  }

  const apiId = Number(apiIdRaw);
  if (!Number.isInteger(apiId) || apiId <= 0) {
    console.error('✗ TELEGRAM_API_ID must be a positive integer.');
    process.exit(1);
  }

  console.log('→ Signing in to Telegram for storage access…');
  console.log('  (Telegram will send a login code to that account.)\n');

  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await ask.text('Phone (+E.164, e.g. +14155551234): '),
    password: async () => await ask.text('2FA password (blank if none): '),
    phoneCode: async () => await ask.text('Code from Telegram: '),
    onError: (err: Error) => console.error('  …error:', err.message),
  });

  console.log('\n✓ Signed in. Copy the line below into backend/.env:\n');
  console.log(`TELEGRAM_SESSION_STRING=${client.session.save()}`);
  console.log(
    '\nKeep this secret — anyone with it can act as your storage account.',
  );

  await client.disconnect();
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('✗ Session setup failed:', err);
  process.exit(1);
});
