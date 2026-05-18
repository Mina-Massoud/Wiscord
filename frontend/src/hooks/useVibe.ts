import { useSession } from '@/queries/auth';
import type { Role, Vibe } from '@/types/auth';

/**
 * Per-role default vibe. Keeps the genz default for students (the
 * original Wiscord audience) and swaps to professional for teachers
 * so the first Wismate reply on a teacher account doesn't show up
 * with 💀 emojis in front of a class.
 */
const ROLE_DEFAULT_VIBE: Record<Role, Vibe> = {
  student: 'genz',
  teacher: 'professional',
};

export function defaultVibeForRole(role: Role): Vibe {
  return ROLE_DEFAULT_VIBE[role];
}

/**
 * Thin selector over the signed-in user's `vibe`. Falls back to `genz`
 * when the session hasn't loaded yet or the user is signed out — the
 * historic default keeps preview surfaces (sign-in, callback) on a
 * single voice.
 */
export function useVibe(): Vibe {
  const session = useSession();
  return session.data?.vibe ?? 'genz';
}

/**
 * Signed-in role. Defaults to `student` for the same reason as above.
 */
export function useRole(): Role {
  const session = useSession();
  return session.data?.role ?? 'student';
}
