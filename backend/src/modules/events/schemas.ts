import { z } from 'zod';
import type { RsvpStatus, ServerEventStatus, ServerEventType } from '../../db/models/index.js';

const objectIdField = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

// ─── Params ─────────────────────────────────────────────────────────────────

export const serverIdParam = z.object({ serverId: objectIdField });
export type ServerIdParam = z.infer<typeof serverIdParam>;

export const eventIdParam = z.object({ eventId: objectIdField });
export type EventIdParam = z.infer<typeof eventIdParam>;

// ─── Request bodies ──────────────────────────────────────────────────────────

export const createEventBody = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(100, 'At most 100 characters'),
    description: z.string().trim().max(2000, 'At most 2000 characters').nullish(),
    type: z.enum(['voice_channel', 'stage_channel', 'external']),
    channelId: objectIdField.nullish(),
    externalLink: z.string().url('Must be a valid URL').max(2048).nullish(),
    startsAt: z.string().datetime({ message: 'Must be an ISO 8601 datetime' }),
    endsAt: z.string().datetime({ message: 'Must be an ISO 8601 datetime' }).nullish(),
    coverColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex color like #5865F2')
      .nullish(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type !== 'external' && !data.channelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'channelId is required for voice/stage channel events',
        path: ['channelId'],
      });
    }
    if (data.type === 'external' && !data.externalLink) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'externalLink is required for external events',
        path: ['externalLink'],
      });
    }
    if (data.endsAt && data.endsAt <= data.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endsAt must be after startsAt',
        path: ['endsAt'],
      });
    }
  });

export type CreateEventBody = z.infer<typeof createEventBody>;

export const updateEventBody = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2000).nullish(),
    type: z.enum(['voice_channel', 'stage_channel', 'external']).optional(),
    channelId: objectIdField.nullish(),
    externalLink: z.string().url().max(2048).nullish(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().nullish(),
    coverColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .nullish(),
    status: z.enum(['scheduled', 'active', 'completed', 'cancelled']).optional(),
  })
  .strict();

export type UpdateEventBody = z.infer<typeof updateEventBody>;

export const upsertRsvpBody = z
  .object({
    status: z.enum(['going', 'interested']),
  })
  .strict();

export type UpsertRsvpBody = z.infer<typeof upsertRsvpBody>;

// ─── DTOs (response shapes) ──────────────────────────────────────────────────

export interface CreatorDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface EventDto {
  id: string;
  serverId: string;
  creatorId: string;
  title: string;
  description: string | null;
  type: ServerEventType;
  channelId: string | null;
  externalLink: string | null;
  startsAt: string;
  endsAt: string | null;
  coverColor: string | null;
  status: ServerEventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventWithMetaDto extends EventDto {
  goingCount: number;
  interestedCount: number;
  myRsvp: RsvpStatus | null;
  creator: CreatorDto;
}

export interface EventsEnvelope {
  events: EventWithMetaDto[];
}

export interface EventEnvelope {
  event: EventWithMetaDto;
}
