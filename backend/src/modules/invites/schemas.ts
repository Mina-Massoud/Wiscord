import { z } from 'zod';

const objectIdField = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

export const serverIdParam = z.object({ serverId: objectIdField });
export type ServerIdParam = z.infer<typeof serverIdParam>;

export const inviteCodeParam = z.object({
  code: z
    .string()
    .trim()
    .min(6, 'Invalid invite code')
    .max(24, 'Invalid invite code')
    .transform((c) => c.toLowerCase()),
});
export type InviteCodeParam = z.infer<typeof inviteCodeParam>;

export const createInviteBody = z
  .object({
    /** When set to 1, the link works for a single join (one person). */
    maxUses: z.literal(1).optional(),
  })
  .strict();

export type CreateInviteBody = z.infer<typeof createInviteBody>;

export interface InviteDto {
  id: string;
  code: string;
  serverId: string;
  createdBy: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  isDefault: boolean;
  createdAt: string;
}

export interface InviteEnvelope {
  invite: InviteDto;
}

export interface InvitesEnvelope {
  invites: InviteDto[];
}

export interface RedeemInviteEnvelope {
  serverId: string;
}
