/* eslint-disable no-console */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import inputLib from 'input';

interface InputPrompt {
  text(prompt: string): Promise<string>;
}
const ask: InputPrompt = inputLib as InputPrompt;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '..', '.env');

function patchEnvFile(key: string, value: string): void {
  let content = readFileSync(ENV_PATH, 'utf-8');
  const regex = new RegExp(`^${key}\\s*=.*$`, 'm');
  const line = `${key}=${value}`;

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content = content.trimEnd() + '\n' + line + '\n';
  }

  writeFileSync(ENV_PATH, content, 'utf-8');
}

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

  const newSession = client.session.save() as unknown as string;

  patchEnvFile('TELEGRAM_SESSION_STRING', newSession);
  console.log('\n✓ Signed in. TELEGRAM_SESSION_STRING written to backend/.env');

  await client.disconnect();
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('✗ Session setup failed:', err);
  process.exit(1);
});
