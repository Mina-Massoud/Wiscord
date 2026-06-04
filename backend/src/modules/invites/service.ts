import { randomBytes } from 'node:crypto';

import { Invite, ServerMember, type InviteDoc } from '../../db/models/index.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import type { CreateInviteBody, InviteDto } from './schemas.js';

const INVITE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz23456789';

function toInviteDto(doc: InviteDoc): InviteDto {
  return {
    id: doc._id.toString(),
    code: doc.code,
    serverId: doc.serverId.toString(),
    createdBy: doc.createdBy.toString(),
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
    maxUses: doc.maxUses ?? null,
    useCount: doc.useCount,
    isDefault: doc.isDefault,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function generateInviteCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length]!;
  }
  return code;
}

async function createInviteWithRetry(
  serverId: string,
  createdBy: string,
  opts: { isDefault: boolean; maxUses?: number | null },
): Promise<InviteDoc> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await Invite.create({
        code: generateInviteCode(),
        serverId,
        createdBy,
        maxUses: opts.maxUses ?? null,
        isDefault: opts.isDefault,
      });
    } catch (err: unknown) {
      const isDup =
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: number }).code === 11000;
      if (!isDup || attempt === 4) throw err;
    }
  }
  throw new Error('invite_code_generation_failed');
}

/**
 * Seeds the server's permanent share link (unlimited uses).
 * Called from server creation.
 */
export async function createDefaultInviteForServer(
  serverId: string,
  createdBy: string,
): Promise<InviteDto> {
  const doc = await createInviteWithRetry(serverId, createdBy, { isDefault: true });
  return toInviteDto(doc);
}

/**
 * Invites are owner-managed: only the server owner may view, list, or create
 * them. Membership alone is not enough (regular members can't generate links).
 */
async function assertServerOwner(userId: string, serverId: string): Promise<void> {
  const membership = await ServerMember.findOne({ serverId, userId }).lean();
  if (!membership) {
    throw notFound('server');
  }
  if (membership.role !== 'owner') {
    throw forbidden('Only the server owner can manage invites.');
  }
}

/**
 * Returns the server's default unlimited invite, creating one for legacy servers.
 */
export async function getDefaultInviteForServer(
  userId: string,
  serverId: string,
): Promise<InviteDto> {
  await assertServerOwner(userId, serverId);

  let invite = await Invite.findOne({ serverId, isDefault: true }).exec();
  if (!invite) {
    invite = await createInviteWithRetry(serverId, userId, { isDefault: true });
  }
  return toInviteDto(invite);
}

/**
 * Creates an additional invite. `maxUses: 1` yields a single-use link for one person.
 */
export async function createInviteForServer(
  userId: string,
  serverId: string,
  body: CreateInviteBody,
): Promise<InviteDto> {
  await assertServerOwner(userId, serverId);
  const doc = await createInviteWithRetry(serverId, userId, {
    isDefault: false,
    maxUses: body.maxUses ?? null,
  });
  return toInviteDto(doc);
}

export async function listInvitesForServer(userId: string, serverId: string): Promise<InviteDto[]> {
  await assertServerOwner(userId, serverId);
  const invites = await Invite.find({ serverId }).sort({ createdAt: -1 }).exec();
  return invites.map((doc) => toInviteDto(doc));
}

function assertInviteUsable(invite: InviteDoc): void {
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    throw badRequest('invite_expired', 'This invite has expired.');
  }
  if (invite.maxUses != null && invite.useCount >= invite.maxUses) {
    throw badRequest('invite_exhausted', 'This invite has already been used.');
  }
}

/**
 * Adds the caller as a member. Idempotent when already a member.
 */
export async function redeemInvite(userId: string, code: string): Promise<{ serverId: string }> {
  const invite = await Invite.findOne({ code: code.toLowerCase() }).exec();
  if (!invite) {
    throw notFound('invite');
  }

  const serverId = invite.serverId.toString();

  // Already a member → idempotent no-op; never consumes a use.
  const existing = await ServerMember.findOne({ serverId: invite.serverId, userId }).lean();
  if (existing) {
    return { serverId };
  }

  // Surface a precise error (expired vs. exhausted) for the common, non-racing case.
  assertInviteUsable(invite);

  // Atomically claim one use. The filter re-checks expiry + maxUses inside the same
  // write, so two concurrent redemptions of a single-use invite can't both pass —
  // this mirrors the magic-link single-use pattern in CLAUDE.md.
  const now = new Date();
  const claimed = await Invite.findOneAndUpdate(
    {
      _id: invite._id,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ maxUses: null }, { $expr: { $lt: ['$useCount', '$maxUses'] } }] },
      ],
    },
    { $inc: { useCount: 1 } },
  ).exec();

  if (!claimed) {
    // Lost the race for the last remaining use.
    throw badRequest('invite_exhausted', 'This invite has already been used.');
  }

  try {
    await ServerMember.create({ serverId: invite.serverId, userId, role: 'member' });
  } catch (err: unknown) {
    // Give the use back — we claimed it but didn't actually add this member.
    await Invite.updateOne({ _id: invite._id }, { $inc: { useCount: -1 } });
    const isDup =
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 11000;
    if (isDup) {
      // A concurrent redeem by the same user already joined them — treat as success.
      return { serverId };
    }
    throw err;
  }

  return { serverId };
}
