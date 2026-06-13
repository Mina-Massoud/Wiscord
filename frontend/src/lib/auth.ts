/**
 * Pure error normalization for auth + profile mutations.
 * Maps the backend's typed error codes (delivered via ApiError) and
 * generic network failures into the project's typed AuthError / ProfileError.
 */
import { ApiError } from '@/queries/client';
import type { AuthError, ProfileError, ProfileErrorCode } from '@/types/auth';

export function normalizeAuthError(e: unknown): AuthError {
  if (e instanceof ApiError) {
    if (e.code === 'network') {
      return { code: 'network', message: 'Network error. Check your connection.', cause: e };
    }
    if (e.status === 429 || e.code === 'too_many_requests') {
      return {
        code: 'rate_limited',
        message: 'Too many attempts. Please wait a minute and try again.',
        cause: e,
      };
    }
    if (e.code === 'invalid_credentials') {
      return { code: 'invalid_credentials', message: 'Wrong email or password.', cause: e };
    }
    if (e.code === 'email_taken') {
      return {
        code: 'email_taken',
        message: 'An account with this email already exists. Try signing in instead.',
        cause: e,
      };
    }
    // A too-short password trips the backend's Zod `min(8)` as invalid_input,
    // but only the password field can realistically be invalid here (the email
    // field is validated client-side before submit), so map it to weak_password.
    if (e.code === 'invalid_input' && /password/i.test(e.message)) {
      return {
        code: 'weak_password',
        message: 'Password must be at least 8 characters.',
        cause: e,
      };
    }
    if (e.code === 'invalid_input' || /email/i.test(e.message)) {
      return { code: 'invalid_email', message: 'Please enter a valid email address.', cause: e };
    }
    return { code: 'unknown', message: e.message, cause: e };
  }

  const message = e instanceof Error ? e.message : String(e);
  return { code: 'unknown', message, cause: e };
}

export function normalizeProfileError(e: unknown): ProfileError {
  if (e instanceof ApiError) {
    if (e.code === 'network') {
      return { code: 'network', message: 'Network error. Check your connection.', cause: e };
    }
    if (e.code === 'username_taken') {
      return {
        code: 'username_taken',
        message: 'That username is already taken. Please choose another.',
        cause: e,
      };
    }
    if (e.code === 'invalid_input') {
      return {
        code: 'username_invalid',
        message: 'Username must be 2–32 characters: letters, numbers, or underscores.',
        cause: e,
      };
    }
    const code: ProfileErrorCode = /username/i.test(e.message) ? 'username_invalid' : 'unknown';
    return { code, message: e.message, cause: e };
  }

  const message = e instanceof Error ? e.message : String(e);
  return { code: 'unknown', message, cause: e };
}
