import { z } from 'zod';

const usernameField = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9_]+$/i, 'Letters, numbers, and underscores only');

const objectIdField = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, 'Invalid id');

export const sendRequestBody = z.object({ username: usernameField }).strict();
export type SendRequestBody = z.infer<typeof sendRequestBody>;

export const requestIdParam = z.object({ id: objectIdField });
export type RequestIdParam = z.infer<typeof requestIdParam>;

export const friendIdParam = z.object({ userId: objectIdField });
export type FriendIdParam = z.infer<typeof friendIdParam>;

export const searchQuery = z.object({
  q: z
    .string()
    .min(2, 'At least 2 characters')
    .max(32)
    .regex(/^[a-z0-9_]+$/i, 'Letters, numbers, and underscores only'),
});
export type SearchQuery = z.infer<typeof searchQuery>;

// ── DTO shapes (wire format) ──────────────────────────────────────────────
//
// The frontend never sees Mongoose docs directly — services return these.

export interface FriendUserDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FriendRequestDto {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  respondedAt: string | null;
  /** The user on the *other* side of this request, from the caller's POV. */
  user: FriendUserDto;
  /** True when the caller sent this request, false when they received it. */
  outgoing: boolean;
}

export interface FriendDto {
  user: FriendUserDto;
  friendedAt: string;
}
