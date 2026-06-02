import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

export const SERVER_EVENT_TYPES = ['voice_channel', 'stage_channel', 'external'] as const;
export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];

export const SERVER_EVENT_STATUSES = ['scheduled', 'active', 'completed', 'cancelled'] as const;
export type ServerEventStatus = (typeof SERVER_EVENT_STATUSES)[number];

const serverEventSchema = new Schema(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', required: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: null, trim: true, maxlength: 2000 },
    type: { type: String, enum: SERVER_EVENT_TYPES, required: true },
    /** Voice or Stage channel id — null for external type. */
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', default: null },
    /** External meeting URL — null for voice/stage types. */
    externalLink: { type: String, default: null, maxlength: 2048 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    /** Hex color string used for the card accent stripe (e.g. "#5865F2"). */
    coverColor: { type: String, default: null, maxlength: 16 },
    status: {
      type: String,
      enum: SERVER_EVENT_STATUSES,
      required: true,
      default: 'scheduled',
    },
  },
  { timestamps: true, collection: 'server_events' },
);

serverEventSchema.index({ serverId: 1, startsAt: 1 });
serverEventSchema.index({ creatorId: 1 });

applySerialize(serverEventSchema);

export type ServerEventRow = InferSchemaType<typeof serverEventSchema>;
export type ServerEventDoc = HydratedDocument<ServerEventRow>;
export const ServerEvent = model('ServerEvent', serverEventSchema);
