/* eslint-disable no-console */
import 'dotenv/config';
import { uploadDocument, streamMedia, deleteStorageMessage } from '../src/modules/storage/telegram-client.js';

/**
 * Round-trip smoke test for the Telegram storage path. Pushes a tiny payload
 * into Saved Messages, downloads it back, byte-compares, then deletes it.
 *
 * Run: `npx tsx scripts/telegram-smoke-test.ts`
 *
 * No HTTP layer, no auth — proves credentials + connectivity + upload +
 * download + delete all work before pointing the frontend at it.
 */
async function main(): Promise<void> {
  const payload = Buffer.from(`wiscord-smoke-test-${Date.now()}\n`);
  const fileName = 'wiscord-smoke-test.txt';

  console.log('→ uploading', payload.length, 'bytes…');
  const uploaded = await uploadDocument({
    bytes: payload,
    mimeType: 'text/plain',
    fileName,
  });
  console.log('✓ uploaded as message id', uploaded.telegramMessageId);

  console.log('→ downloading…');
  const chunks: Buffer[] = [];
  for await (const chunk of await streamMedia(uploaded.telegramMessageId)) {
    chunks.push(chunk);
  }
  const downloaded = Buffer.concat(chunks);
  const matches = downloaded.equals(payload);
  console.log('✓ downloaded', downloaded.length, 'bytes; match =', matches);

  if (!matches) {
    console.error('✗ bytes did not match!');
    process.exit(1);
  }

  console.log('→ cleaning up…');
  await deleteStorageMessage(uploaded.telegramMessageId);
  console.log('✓ deleted message');

  console.log('\n🎉 Telegram storage round-trip works.');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('✗ smoke test failed:', err);
  process.exit(1);
});
