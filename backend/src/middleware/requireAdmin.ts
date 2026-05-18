import type { Request, Response, NextFunction } from 'express';

import { User } from '../db/models/User.js';
import { env } from '../lib/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';

/**
 * Admin allowlist — `req.userId`'s email must appear in
 * `ADMIN_EMAILS` (comma-separated, case-insensitive). Returns 403
 * otherwise. Stack on top of `requireAuth`, never alone — without
 * the auth middleware first, `req.userId` is undefined and we
 * 401 every caller.
 *
 * Intentionally not RBAC. v1 has exactly one admin (the founder).
 * When a second admin lands, replace this with a `User.role` field
 * and a generic permission check.
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    return next(unauthorized('Sign in required'));
  }
  const allowlist = env.ADMIN_EMAILS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (allowlist.length === 0) {
    return next(forbidden('Admin access is disabled (no ADMIN_EMAILS configured)'));
  }
  const user = await User.findById(req.userId).select({ email: 1 }).lean<{ email?: string } | null>();
  const email = user?.email?.toLowerCase();
  if (!email || !allowlist.includes(email)) {
    return next(forbidden('Admin access only'));
  }
  next();
}
