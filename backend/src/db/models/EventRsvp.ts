import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

export const RSVP_STATUSES = ['going', 'interested'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

const eventRsvpSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'ServerEvent', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: RSVP_STATUSES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'event_rsvps' },
);

eventRsvpSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventRsvpSchema.index({ userId: 1 });
eventRsvpSchema.index({ eventId: 1 });

applySerialize(eventRsvpSchema);

export type EventRsvpRow = InferSchemaType<typeof eventRsvpSchema>;
export type EventRsvpDoc = HydratedDocument<EventRsvpRow>;
export const EventRsvp = model('EventRsvp', eventRsvpSchema);
