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

  // Gemini API. Optional in dev so the rest of the app boots
  // without a key; /ai/ask returns 503 `ai_not_configured` when
  // GOOGLE_API_KEY is missing. Default is `gemini-2.0-flash` —
  // handles tool calling + casual chat in the same call without
  // the empty-reply quirks of the Gemma open variants. Swap to
  // `gemini-2.5-flash` for stronger reasoning at higher cost.
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

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

  // Stripe — required to enable the billing module. Optional in dev so
  // the rest of the app boots without a Stripe account; required in
  // production (enforced by the post-parse guard below) so a misconfigured
  // deploy can't silently drop every webhook delivery for 3 days before
  // Stripe gives up retrying. The billing routes throw a friendly 503
  // when STRIPE_SECRET_KEY is missing in dev.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),

  // Music integrations (Spotify + YouTube Music via Google OAuth). All
  // optional in dev — the /integrations routes return 503
  // `integration_not_configured` when the provider's vars are missing.
  // Redirect URIs must match the providers' dashboards exactly.
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().url().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // 32-byte hex (64 chars) — encrypts refresh/access tokens at rest. If
  // unset, the integrations module derives a key from JWT_SECRET via HKDF
  // so dev sign-ups don't require extra setup, but rotating JWT_SECRET
  // then invalidates every stored token. Set this explicitly in prod.
  INTEGRATION_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'INTEGRATION_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    .optional(),

  // Comma-separated list of email addresses authorized to hit
  // /admin/* endpoints. Kept intentionally low-tech for v1 — when
  // we need real role-based access control it'll be a `User.role`
  // field and a proper RBAC middleware. Today there's exactly one
  // admin (the founder), so a hardcoded allowlist beats building
  // a full permissions system.
  ADMIN_EMAILS: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/**
 * Production-only env requirements. Variables that are optional in dev
 * (so the rest of the app boots without external services configured)
 * but mandatory in production because their absence creates silent
 * failure modes — e.g. STRIPE_WEBHOOK_SECRET missing means every Stripe
 * webhook gets rejected with 400 and after 3 days of retries Stripe
 * gives up, so we silently lose every subscription event.
 *
 * Listed explicitly here so adding a new prod-required var is a one-
 * liner and the failure mode for each is documented.
 */
const PRODUCTION_REQUIRED: Array<{
  key: keyof typeof parsed.data;
  why: string;
}> = [
  {
    key: 'STRIPE_SECRET_KEY',
    why: 'every billing route returns 503 without it',
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    why: 'every Stripe webhook gets rejected with 400 — subscription state silently desyncs',
  },
  {
    key: 'STRIPE_PRICE_PRO_MONTHLY',
    why: 'checkout returns 400 billing_price_unconfigured',
  },
];

if (parsed.data.NODE_ENV === 'production') {
  const missing = PRODUCTION_REQUIRED.filter(({ key }) => {
    const value = parsed.data[key];
    return value === undefined || value === '';
  });
  if (missing.length > 0) {
    console.error('[env] missing production-required environment variables:');
    for (const { key, why } of missing) {
      console.error(`  - ${key}: ${why}`);
    }
    process.exit(1);
  }
}

export const env = parsed.data;
export type Env = typeof env;
