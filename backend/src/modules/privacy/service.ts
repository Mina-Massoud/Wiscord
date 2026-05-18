import { User } from '../../db/models/User.js';
import { notFound } from '../../lib/errors.js';
import type { PrivacyPatch, PrivacyResponse } from './schemas.js';

const DEFAULTS: PrivacyResponse = {
  allowDmsFromStrangers: true,
  allowFriendRequestsFromEveryone: true,
  shareUsageAnalytics: true,
};

export async function getPrivacy(userId: string): Promise<PrivacyResponse> {
  const user = await User.findById(userId)
    .select({ privacy: 1 })
    .lean<{ privacy?: Partial<PrivacyResponse> } | null>();

  if (!user) throw notFound('user');

  return { ...DEFAULTS, ...(user.privacy ?? {}) };
}

export async function updatePrivacy(
  userId: string,
  patch: PrivacyPatch,
): Promise<PrivacyResponse> {
  const set: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'boolean') set[`privacy.${key}`] = value;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: set },
    { new: true, projection: { privacy: 1 }, lean: true },
  ).lean<{ privacy?: Partial<PrivacyResponse> } | null>();

  if (!user) throw notFound('user');

  return { ...DEFAULTS, ...(user.privacy ?? {}) };
}
