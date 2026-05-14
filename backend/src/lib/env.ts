import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('debug'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  MAGIC_LINK_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 15),

  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('onboarding@resend.dev'),
  RESEND_FROM_NAME: z.string().default('Wiscord'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),

  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local', 's3', 'telegram']).default('telegram'),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  // Telegram-as-bucket (free, no extra cost). Uses MTProto (a user account,
  // not a bot) so the Bot API's 20 MB download cap doesn't apply — handles
  // images, voice notes, videos, and gifs.
  //   1. Register an app at https://my.telegram.org/apps → API_ID + API_HASH
  //   2. Run `npm run storage:login` once → prints SESSION_STRING to paste here
  // Storage chat is hardcoded to "Saved Messages" (chat with yourself).
  TELEGRAM_API_ID: z.coerce.number().int().positive().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_SESSION_STRING: z.string().optional(),
  // Hard ceiling on a single upload. Express buffers the whole request in
  // memory before handing it off, so this should stay well under available
  // RAM. Bump only after switching to disk-streaming upload.
  STORAGE_MAX_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
