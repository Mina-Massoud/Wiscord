import { User } from '../../db/models/User.js';
import { notFound } from '../../lib/errors.js';
import type { CurrentSessionResponse } from './schemas.js';

interface CurrentSessionInput {
  userId: string;
  userAgent: string | undefined;
  ip: string | undefined;
}

/**
 * v1 session info: we don't store sessions, so this synthesizes a single
 * "current session" entry from the request itself plus the user's last
 * sessionsValidAfter as the lower bound for "signed in since".
 */
export async function getCurrentSession({
  userId,
  userAgent,
  ip,
}: CurrentSessionInput): Promise<CurrentSessionResponse & { rawSignedInAt: Date | null }> {
  const user = await User.findById(userId)
    .select({ 'security.sessionsValidAfter': 1, createdAt: 1 })
    .lean<{ security?: { sessionsValidAfter: Date | null }; createdAt: Date } | null>();

  if (!user) throw notFound('user');

  const { parseUserAgent, maskIp } = await import('./parse-user-agent.js');

  // Best-effort "signed in at" — if we've never revoked, fall back to the
  // account creation date. The JWT iat would be more accurate but we don't
  // surface it through here.
  const signedInAt = user.security?.sessionsValidAfter ?? user.createdAt ?? null;

  return {
    device: parseUserAgent(userAgent),
    ipMasked: maskIp(ip),
    signedInAt: signedInAt ? signedInAt.toISOString() : null,
    rawSignedInAt: signedInAt,
  };
}

/**
 * Bumps the user's sessionsValidAfter to now. Every JWT issued before this
 * timestamp is rejected by `requireAuth`. The caller's session is **not**
 * invalidated here — the route handler re-issues their cookie with a fresh
 * iat so the click doesn't log the user out of the device they're on.
 */
export async function bumpSessionsValidAfter(userId: string): Promise<Date> {
  const now = new Date();
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { 'security.sessionsValidAfter': now } },
    { new: true, projection: { _id: 1 } },
  ).lean();

  if (!user) throw notFound('user');
  return now;
}
