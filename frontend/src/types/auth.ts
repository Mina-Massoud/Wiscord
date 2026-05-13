export interface Profile {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  onboarded_at: string | null; // ISO 8601
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
  }
>;

// Typed auth errors
export type AuthErrorCode = 'invalid_email' | 'rate_limited' | 'network' | 'unknown';
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
