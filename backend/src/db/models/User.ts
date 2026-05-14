import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 32,
    },
    displayName: { type: String, default: null, maxlength: 64 },
    avatarUrl: { type: String, default: null },
    onboardedAt: { type: Date, default: null },
    voiceStyle: {
      type: String,
      enum: ['default', 'genz'],
      default: 'default',
    },
  },
  { timestamps: true, collection: 'users' },
);

// Note: no explicit `userSchema.index({ username: 1 })` — the `unique: true`
// constraint on the field already creates that index.

applySerialize(userSchema);

export type UserRow = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserRow>;
export const User = model('User', userSchema);
