import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

const magicLinkTokenSchema = new Schema(
  {
    // SHA-256 of the raw token. Raw value only ever exists in the user's email.
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    redirectTo: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'magic_link_tokens' },
);

// TTL index — Mongo auto-deletes expired-but-unused tokens after a 24h grace.
magicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

applySerialize(magicLinkTokenSchema);

export type MagicLinkTokenRow = InferSchemaType<typeof magicLinkTokenSchema>;
export type MagicLinkTokenDoc = HydratedDocument<MagicLinkTokenRow>;
export const MagicLinkToken = model('MagicLinkToken', magicLinkTokenSchema);
