import { User } from '../../db/models/index.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { AppError, conflict, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { UpdateProfileBody } from './schemas.js';

// A well-formed-but-unmatchable hash (N=32768, 16-byte salt, 64-byte key) used
// to spend the same scrypt time on an unknown-email sign-in as on a real one,
// so response timing doesn't reveal whether the email exists. The actual bytes
// never match any real password — it only needs to be valid `scrypt$…` shape.
const DUMMY_HASH = `scrypt$32768$${'0'.repeat(32)}$${'0'.repeat(128)}`;

/**
 * Create a new account from an email + password. The username is derived from
 * the email local-part (disambiguated with a suffix on collision); the user
 * finishes the rest of their profile in onboarding. Returns the userId so the
 * caller can issue a session cookie.
 *
 * Unlike the old magic-link flow there's no anti-enumeration dance here — a
 * caller who tries to register an existing email *must* be told (otherwise we'd
 * silently swallow the signup), so a taken email returns `409 email_taken`.
 */
export async function signUp(email: string, password: string): Promise<{ userId: string }> {
  const lower = email.trim().toLowerCase();

  const existing = await User.exists({ email: lower });
  if (existing) {
    throw conflict('email_taken', 'An account with this email already exists.');
  }

  const username = await pickAvailableUsername(lower);
  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await User.create({ email: lower, username, passwordHash });
  } catch (err) {
    // Lost a race against a concurrent signup with the same email — the unique
    // index rejected the insert. Surface it as the same friendly conflict.
    if (err instanceof Error && 'code' in err && (err as { code?: number }).code === 11000) {
      throw conflict('email_taken', 'An account with this email already exists.');
    }
    throw err;
  }

  logger.info({ email: lower, userId: user._id.toString() }, 'auth: account created');
  return { userId: user._id.toString() };
}

/**
 * Verify an email + password. Returns the userId so the caller can issue a
 * session cookie. A wrong email and a wrong password fail identically with
 * `401 invalid_credentials` so we don't leak which emails are registered.
 */
export async function signIn(email: string, password: string): Promise<{ userId: string }> {
  const lower = email.trim().toLowerCase();

  // passwordHash is `select: false` on the schema — pull it in explicitly.
  const user = await User.findOne({ email: lower }).select('+passwordHash');

  // Same error for "no such email" and "wrong password" — don't leak which
  // emails are registered. Still run a verify on a miss to keep the timing of
  // both branches roughly equal (a constant dummy hash with the same params).
  const invalid = new AppError(401, 'invalid_credentials', 'Wrong email or password.');

  if (!user || !user.passwordHash) {
    await verifyPassword(password, DUMMY_HASH);
    throw invalid;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw invalid;

  logger.info({ userId: user._id.toString() }, 'auth: signed in');
  return { userId: user._id.toString() };
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
