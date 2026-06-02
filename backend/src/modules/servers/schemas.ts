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
  })
  .strict()
  .refine((b) => b.name !== undefined || b.iconUrl !== undefined, {
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
  createdAt: string;
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
}

export interface ChannelsEnvelope {
  channels: ChannelDto[];
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

export interface ChannelEnvelope {
  channel: ChannelDto;
}
