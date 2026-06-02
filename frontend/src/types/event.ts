export type EventType = 'voice_channel' | 'stage_channel' | 'external';
export type RsvpStatus = 'going' | 'interested';
export type EventStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface CreatorProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface EventWithMeta {
  id: string;
  serverId: string;
  creatorId: string;
  title: string;
  description: string | null;
  type: EventType;
  channelId: string | null;
  externalLink: string | null;
  startsAt: string;
  endsAt: string | null;
  coverColor: string | null;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  goingCount: number;
  interestedCount: number;
  myRsvp: RsvpStatus | null;
  creator: CreatorProfile;
}

export interface CreateEventDto {
  title: string;
  description?: string | null;
  type: EventType;
  channelId?: string | null;
  externalLink?: string | null;
  startsAt: string;
  endsAt?: string | null;
  coverColor?: string | null;
}

export interface UpdateEventDto {
  title?: string;
  description?: string | null;
  type?: EventType;
  channelId?: string | null;
  externalLink?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  coverColor?: string | null;
  status?: EventStatus;
}

export interface UpsertRsvpDto {
  status: RsvpStatus;
}
