import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

const serverSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 64 },
    iconUrl: { type: String, default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'servers' },
);

serverSchema.index({ ownerId: 1 });

applySerialize(serverSchema);

export type ServerRow = InferSchemaType<typeof serverSchema>;
export type ServerDoc = HydratedDocument<ServerRow>;
export const Server = model('Server', serverSchema);
