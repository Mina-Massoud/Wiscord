import { z } from 'zod';

export const privacyPatchBody = z
  .object({
    allowDmsFromStrangers: z.boolean().optional(),
    allowFriendRequestsFromEveryone: z.boolean().optional(),
    shareUsageAnalytics: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

export type PrivacyPatch = z.infer<typeof privacyPatchBody>;

export interface PrivacyResponse {
  allowDmsFromStrangers: boolean;
  allowFriendRequestsFromEveryone: boolean;
  shareUsageAnalytics: boolean;
}
