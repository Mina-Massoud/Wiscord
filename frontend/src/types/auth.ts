/**
 * Who the user is. Captured during onboarding (`/onboarding/role`) and
 * editable from settings. Drives the *default* `vibe` (`student → genz`,
 * `teacher → professional`) but the user can override.
 */
export type Role = 'student' | 'teacher';

/**
 * How Wiscord sounds — applies to every user-facing string (toasts,
 * empty states, button labels) AND to the Wismate AI's voice (system
 * prompt + few-shot prefill).
 *
 * Three vibes, locked at the type level so the backend can keep N
 * static AI prompt bundles for Gemini's prefix cache:
 *  - `genz`         — dry, lowkey, group-chat energy. Default for students.
 *  - `chill`        — warm and casual, no slang, no profanity, light emojis.
 *  - `professional` — formal, full sentences, zero emojis, teacher-safe. Default for teachers.
 */
export type Vibe = 'genz' | 'chill' | 'professional';

export interface Profile {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  onboarded_at: string | null; // ISO 8601
  role: Role;
  vibe: Vibe;
  created_at: string;
  updated_at: string;
}

export interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  created_at: string;
}

export type ProfileUpdate = Partial<
  Pick<Profile, 'username'> & {
    display_name: string | null;
    avatar_url: string | null;
    onboarded_at: string | null;
    role: Role;
    vibe: Vibe;
  }
>;

// Typed auth errors
export type AuthErrorCode =
  | 'invalid_email'
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
  | 'rate_limited'
  | 'network'
  | 'unknown';
export interface AuthError {
  code: AuthErrorCode;
  message: string;
  cause?: unknown;
}

// Typed profile errors
export type ProfileErrorCode = 'username_taken' | 'username_invalid' | 'network' | 'unknown';
export interface ProfileError {
  code: ProfileErrorCode;
  message: string;
  cause?: unknown;
}
