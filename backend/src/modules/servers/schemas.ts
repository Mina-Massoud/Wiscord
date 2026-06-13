import { z } from 'zod';

const objectIdField = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

export const createServerBody = z
  .object({
    name: z.string().trim().min(2, 'At least 2 characters').max(64, 'At most 64 characters'),
    iconUrl: z.string().url().max(2048).nullish(),
  })
  .strict();

export type CreateServerBody = z.infer<typeof createServerBody>;

export const updateServerBody = z
  .object({
    name: z.string().trim().min(2, 'At least 2 characters').max(64, 'At most 64 characters').optional(),
    iconUrl: z.string().url().max(2048).nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .strict()
  .refine((b) => b.name !== undefined || b.iconUrl !== undefined || b.isPublic !== undefined, {
    message: 'Provide at least one field to update.',
  });

export type UpdateServerBody = z.infer<typeof updateServerBody>;

export const serverIdParam = z.object({ serverId: objectIdField });
export type ServerIdParam = z.infer<typeof serverIdParam>;

export interface ServerDto {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
}

/** A public server surfaced in discovery — a non-member's view (no ownerId). */
export interface DiscoverServerDto {
  id: string;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  /** First text channel to land in on join, or null if the server has none. */
  firstChannelId: string | null;
  blurb: string | null;
}

export interface DiscoverServersEnvelope {
  servers: DiscoverServerDto[];
}

export interface ServersEnvelope {
  servers: ServerDto[];
}

export interface ServerEnvelope {
  server: ServerDto;
}

export type ChannelTypeDto = 'text' | 'voice';

export interface ChannelDto {
  id: string;
  serverId: string;
  name: string;
  type: ChannelTypeDto;
  position: number;
  createdAt: string;
  unreadCount?: number;
}

export interface ChannelsEnvelope {
  channels: ChannelDto[];
}

export interface ServerMemberUserDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ServerMemberDto {
  id: string;
  serverId: string;
  userId: string;
  role: 'owner' | 'member';
  user: ServerMemberUserDto;
}

export interface ServerMembersEnvelope {
  members: ServerMemberDto[];
}

export interface CreateServerEnvelope {
  server: ServerDto;
  channels: ChannelDto[];
}

const channelNameField = z
  .string()
  .trim()
  .min(2, 'At least 2 characters')
  .max(64, 'At most 64 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Letters, numbers, and hyphens only');

export const createChannelBody = z
  .object({
    name: channelNameField,
    type: z.enum(['text', 'voice']),
  })
  .strict();

export type CreateChannelBody = z.infer<typeof createChannelBody>;

export const updateChannelBody = z
  .object({
    name: channelNameField.optional(),
  })
  .strict()
  .refine((b) => b.name !== undefined, { message: 'Provide at least one field to update.' });

export type UpdateChannelBody = z.infer<typeof updateChannelBody>;

export const channelIdParam = z.object({
  serverId: objectIdField,
  channelId: objectIdField,
});
export type ChannelIdParam = z.infer<typeof channelIdParam>;

export const markChannelReadBody = z.object({}).strict();
export type MarkChannelReadBody = z.infer<typeof markChannelReadBody>;

export interface ChannelEnvelope {
  channel: ChannelDto;
}

export interface ServerUnreadDto {
  serverId: string;
  hasUnread: boolean;
  unreadCount: number;
}

export interface ServersUnreadEnvelope {
  servers: ServerUnreadDto[];
}
