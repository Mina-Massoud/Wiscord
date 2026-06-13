import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

const serverSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 64 },
    iconUrl: { type: String, default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** When true, the server is listed in discovery (`GET /servers/discover`)
     *  for non-members to find and join. Defaults to private. */
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'servers' },
);

serverSchema.index({ ownerId: 1 });
// Discovery feed: public servers, newest first.
serverSchema.index({ isPublic: 1, createdAt: -1 });

applySerialize(serverSchema);

export type ServerRow = InferSchemaType<typeof serverSchema>;
export type ServerDoc = HydratedDocument<ServerRow>;
export const Server = model('Server', serverSchema);
