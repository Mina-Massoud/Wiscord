import { z } from 'zod';

// Password: 8–200 chars. Lower bound is the OWASP minimum; upper bound caps
// the scrypt work an attacker can force us to do with a giant input.
const password = z.string().min(8, 'At least 8 characters').max(200);

export const signUpBody = z.object({
  email: z.string().email().max(254),
  password,
});
export type SignUpBody = z.infer<typeof signUpBody>;

export const signInBody = z.object({
  email: z.string().email().max(254),
  password,
});
export type SignInBody = z.infer<typeof signInBody>;

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
    role: z.enum(['student', 'teacher']).optional(),
    vibe: z.enum(['genz', 'chill', 'professional']).optional(),
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
