import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * A single uploaded media object. Bytes live in Telegram (the storage account
 * uploaded them via MTProto into Saved Messages) and this row is the index
 * from our app's identifiers to Telegram's.
 *
 * Under MTProto the durable handle is the message id. The media's file
 * reference inside that message rotates every ~24 h, so on every download we
 * re-fetch the message via `getMessages` to pick up a fresh reference, then
 * stream the bytes back. That's why we don't store `file_id` / `file_unique_id`
 * the way the Bot API forced us to — there's no stable per-file token.
 *
 * `ownerId` is the only access fact today. Once channels ship, `channelId`
 * gates access to media uploaded inside a channel context; personal uploads
 * keep `channelId = null` and stay owner-only.
 */
export const MEDIA_KINDS = ['image', 'audio', 'video', 'gif', 'document'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const mediaAssetSchema = new Schema(
  {
    ownerId: { type: String, required: true },
    channelId: { type: String, default: null },
    kind: { type: String, enum: [...MEDIA_KINDS] as string[], required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    originalName: { type: String, default: null },

    // Telegram-side identifier — the message id in the storage account's
    // Saved Messages chat. Re-fetched on every download to get a fresh
    // file reference. Stored as Number because Telegram message ids fit in
    // a safe integer (well under 2^53) for individual chats.
    telegramMessageId: { type: Number, required: true, index: true },
  },
  { timestamps: true, collection: 'media_assets' },
);

mediaAssetSchema.index({ ownerId: 1, createdAt: -1 });
mediaAssetSchema.index({ channelId: 1, createdAt: -1 });

applySerialize(mediaAssetSchema);

export type MediaAssetRow = InferSchemaType<typeof mediaAssetSchema>;
export type MediaAssetDoc = HydratedDocument<MediaAssetRow>;
export const MediaAsset = model('MediaAsset', mediaAssetSchema);
