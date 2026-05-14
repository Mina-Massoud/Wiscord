import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { CustomFile } from 'telegram/client/uploads.js';

import { env } from '../../lib/env.js';
import { serverError, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

/**
 * Telegram MTProto client wrapper. We log in as a user account (one-time
 * `npm run storage:login` produces TELEGRAM_SESSION_STRING) instead of a bot,
 * because the Bot HTTP API caps `getFile` downloads at 20 MB — which would
 * make videos unreadable after upload. MTProto has no such cap (2 GB per file
 * on free Telegram, 4 GB with Premium).
 *
 * All uploads go to the account's Saved Messages chat (`'me'`). It's private
 * to the storage account, requires no extra setup, and message ids in it are
 * stable forever — that's the durable handle we persist in MongoDB.
 *
 * Connection lifecycle: lazy singleton. The first request connects and the
 * client stays alive for the process lifetime. gramjs handles reconnection
 * on network blips internally.
 */

const STORAGE_PEER = 'me' as const;

let cachedClient: TelegramClient | null = null;
let connectingPromise: Promise<TelegramClient> | null = null;

function requireConfig(): {
  apiId: number;
  apiHash: string;
  session: string;
} {
  const { TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_STRING } = env;
  if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH || !TELEGRAM_SESSION_STRING) {
    throw serverError(
      'Telegram storage is not configured. Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION_STRING in backend/.env. Run `npm run storage:login` to obtain the session string (see backend/.env.example for the full flow).',
    );
  }
  return {
    apiId: TELEGRAM_API_ID,
    apiHash: TELEGRAM_API_HASH,
    session: TELEGRAM_SESSION_STRING,
  };
}

async function getClient(): Promise<TelegramClient> {
  if (cachedClient?.connected) return cachedClient;
  if (connectingPromise) return connectingPromise;

  const { apiId, apiHash, session } = requireConfig();
  connectingPromise = (async () => {
    const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
      connectionRetries: 5,
      useWSS: false,
      // gramjs spams stdout on info-level — silence it; pino owns our logs.
      baseLogger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never,
    });
    await client.connect();
    cachedClient = client;
    logger.info('telegram: MTProto client connected');
    return client;
  })();

  try {
    return await connectingPromise;
  } finally {
    connectingPromise = null;
  }
}

export interface UploadedDocument {
  telegramMessageId: number;
  mimeType: string;
  size: number;
  fileName: string;
}

/**
 * Push bytes to Saved Messages and return the durable message id.
 *
 * We always `forceDocument: true` so Telegram doesn't re-encode the bytes
 * (it would otherwise transcode video, downscale photos, etc.). Filename
 * attribute keeps the original name visible in the Telegram UI for our own
 * debugging.
 */
export async function uploadDocument(input: {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<UploadedDocument> {
  const client = await getClient();

  const message = await client.sendFile(STORAGE_PEER, {
    file: new CustomFile(input.fileName, input.bytes.length, '', input.bytes),
    forceDocument: true,
    attributes: [new Api.DocumentAttributeFilename({ fileName: input.fileName })],
    workers: 1,
  });

  if (!message?.id) {
    throw serverError('Telegram upload returned no message id');
  }

  return {
    telegramMessageId: Number(message.id),
    mimeType: input.mimeType,
    size: input.bytes.length,
    fileName: input.fileName,
  };
}

/**
 * Re-fetch the storage message (so we get a fresh file_reference) and stream
 * its bytes back as an async iterator. The caller is responsible for piping
 * chunks into an HTTP response.
 */
export async function streamMedia(
  telegramMessageId: number,
): Promise<AsyncIterable<Buffer>> {
  const client = await getClient();

  const messages = await client.getMessages(STORAGE_PEER, {
    ids: [telegramMessageId],
  });
  const message = messages[0];

  if (!message?.media) {
    logger.warn({ telegramMessageId }, 'telegram: storage message missing or no media');
    throw notFound('media');
  }

  // gramjs returns Buffer chunks; 512 KB is the default and is a good
  // tradeoff for HTTP streaming (low latency + few round-trips for medium
  // files). The cast is unavoidable — `iterDownload`'s `file` param accepts
  // `TypeInputFileLocation | TypeMessageMedia`, but the union confuses TS at
  // the call site, so we narrow to `any` exactly here.
  const iter = client.iterDownload({
    file: message.media as unknown as Parameters<typeof client.iterDownload>[0]['file'],
    requestSize: 512 * 1024,
  });
  return iter as unknown as AsyncIterable<Buffer>;
}

/**
 * Best-effort cleanup. Telegram refuses to delete messages older than ~48h
 * in some chats — we don't fail the user-facing delete on that, because the
 * Mongo row removal is what makes the asset unreachable from our API.
 */
export async function deleteStorageMessage(telegramMessageId: number): Promise<void> {
  try {
    const client = await getClient();
    await client.deleteMessages(STORAGE_PEER, [telegramMessageId], { revoke: true });
  } catch (err) {
    logger.warn(
      { err, telegramMessageId },
      'telegram: deleteMessage failed (continuing — DB row already removed)',
    );
  }
}

/**
 * Called from the boot path so the first user request doesn't pay the
 * connection RTT. Safe to call multiple times.
 */
export async function warmTelegramClient(): Promise<void> {
  if (!env.TELEGRAM_API_ID || !env.TELEGRAM_API_HASH || !env.TELEGRAM_SESSION_STRING) {
    logger.warn('telegram: storage not configured — skipping warm-up');
    return;
  }
  await getClient();
}
