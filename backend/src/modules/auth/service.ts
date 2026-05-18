import { User, MagicLinkToken } from '../../db/models/index.js';
import { hashToken, newMagicLinkToken } from '../../lib/tokens.js';
import { sendMagicLinkEmail } from '../../lib/mail.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import type { UpdateProfileBody } from './schemas.js';

/**
 * Get-or-create the user row for an email and issue a magic-link token.
 *
 * New email → new user (with a generated username derived from local-part,
 * disambiguated with a suffix on collision). The user finishes their profile
 * in onboarding after the magic link redirects them.
 */
export async function startMagicLink(email: string, redirectTo?: string): Promise<void> {
  const lower = email.trim().toLowerCase();

  let user = await User.findOne({ email: lower });
  if (!user) {
    const username = await pickAvailableUsername(lower);
    user = await User.create({ email: lower, username });
  }

  const { raw, hash } = newMagicLinkToken();
  await MagicLinkToken.create({
    tokenHash: hash,
    userId: user._id,
    expiresAt: new Date(Date.now() + env.MAGIC_LINK_TTL_SECONDS * 1000),
    redirectTo: redirectTo ?? null,
  });

  // The link points at the BACKEND callback. The backend verifies, sets the
  // session cookie, then 302s onward to the frontend.
  const backendOrigin = env.FRONTEND_ORIGIN.replace(/:\d+$/, `:${env.PORT}`);
  const verifyUrl = `${backendOrigin}/auth/callback?token=${encodeURIComponent(raw)}`;

  await sendMagicLinkEmail({ to: lower, url: verifyUrl });

  logger.info({ email: lower, userId: user._id.toString() }, 'auth: magic link issued');
}

/**
 * Verify a magic-link token (hash + not-yet-used + not-expired), mark it
 * used, return the userId so the caller can issue a session cookie.
 */
export async function consumeMagicLink(
  rawToken: string,
): Promise<{ userId: string; redirectTo: string | null }> {
  const hash = hashToken(rawToken);

  // findOneAndUpdate with a usedAt:null guard makes the consume step atomic
  // — replays after a successful consume will see `usedAt != null` and fail.
  const token = await MagicLinkToken.findOneAndUpdate(
    { tokenHash: hash, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );

  if (!token) {
    throw badRequest('invalid_or_expired_token', 'This sign-in link is no longer valid.');
  }

  return {
    userId: token.userId.toString(),
    redirectTo: token.redirectTo ?? null,
  };
}

/**
 * Wire-format user shape. Snake_case to match the existing frontend
 * `Profile` type so consumers don't need to be touched in this slice.
 *
 * `role` and `vibe` come back on every /auth/me read. They have schema
 * defaults so legacy rows that predate this migration still serialize
 * cleanly without a one-off backfill.
 */
export type UserRole = 'student' | 'teacher';
export type UserVibe = 'genz' | 'chill' | 'professional';

export interface CurrentUserDto {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  onboarded_at: string | null;
  role: UserRole;
  vibe: UserVibe;
  created_at: string;
  updated_at: string;
}

export async function getCurrentUser(userId: string): Promise<CurrentUserDto> {
  const user = await User.findById(userId);
  if (!user) throw notFound('user');

  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    display_name: user.displayName ?? null,
    avatar_url: user.avatarUrl ?? null,
    onboarded_at: user.onboardedAt ? user.onboardedAt.toISOString() : null,
    role: (user.role ?? 'student') as UserRole,
    vibe: (user.vibe ?? 'genz') as UserVibe,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

export async function updateProfile(
  userId: string,
  patch: UpdateProfileBody,
): Promise<CurrentUserDto> {
  const update: Record<string, unknown> = {};

  if (patch.username !== undefined) {
    const taken = await User.exists({
      username: patch.username,
      _id: { $ne: userId },
    });
    if (taken) {
      throw conflict('username_taken', 'That username is already taken.');
    }
    update.username = patch.username;
  }
  if (patch.display_name !== undefined) update.displayName = patch.display_name;
  if (patch.avatar_url !== undefined) update.avatarUrl = patch.avatar_url;
  if (patch.onboarded_at !== undefined) {
    update.onboardedAt = patch.onboarded_at ? new Date(patch.onboarded_at) : null;
  }
  if (patch.role !== undefined) update.role = patch.role;
  if (patch.vibe !== undefined) update.vibe = patch.vibe;

  await User.updateOne({ _id: userId }, { $set: update });
  return getCurrentUser(userId);
}

export async function isUsernameAvailable(
  username: string,
  excludeUserId: string | null,
): Promise<boolean> {
  const query: Record<string, unknown> = { username };
  if (excludeUserId) query._id = { $ne: excludeUserId };
  const existing = await User.exists(query);
  return existing === null;
}

async function pickAvailableUsername(email: string): Promise<string> {
  const base = (email.split('@')[0] ?? 'user').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 28);
  // First-try the bare local-part. On collision append 4-char hex.
  const first = base.length >= 2 ? base : `${base}_user`;
  if (await isUsernameAvailable(first, null)) return first;
  for (let i = 0; i < 5; i++) {
    const candidate = `${first}_${Math.random().toString(16).slice(2, 6)}`;
    if (await isUsernameAvailable(candidate, null)) return candidate;
  }
  // Extremely unlikely — fall through to a longer suffix.
  return `${first}_${Math.random().toString(16).slice(2, 10)}`;
}
