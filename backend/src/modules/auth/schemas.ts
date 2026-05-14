import { z } from 'zod';

export const magicLinkBody = z.object({
  email: z.string().email().max(254),
  redirectTo: z.string().optional(),
});
export type MagicLinkBody = z.infer<typeof magicLinkBody>;

export const callbackQuery = z.object({
  token: z.string().min(20).max(200),
});
export type CallbackQuery = z.infer<typeof callbackQuery>;

export const updateProfileBody = z
  .object({
    username: z
      .string()
      .min(2, 'At least 2 characters')
      .max(32, 'At most 32 characters')
      .regex(/^[a-z0-9_]+$/i, 'Letters, numbers, and underscores only')
      .optional(),
    display_name: z.string().min(1).max(64).nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
    onboarded_at: z.string().datetime().nullable().optional(),
    voice_style: z.enum(['default', 'genz']).optional(),
  })
  .strict();
export type UpdateProfileBody = z.infer<typeof updateProfileBody>;

export const checkUsernameQuery = z.object({
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/i),
});
export type CheckUsernameQuery = z.infer<typeof checkUsernameQuery>;
