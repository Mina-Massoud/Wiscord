import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { applySerialize } from '../serialize.js';

const privacySchema = new Schema(
  {
    allowDmsFromStrangers: { type: Boolean, default: true },
    allowFriendRequestsFromEveryone: { type: Boolean, default: true },
    shareUsageAnalytics: { type: Boolean, default: true },
  },
  { _id: false },
);

const securitySchema = new Schema(
  {
    // When the user clicks "Sign out all other devices" we bump this to `now`.
    // The auth middleware rejects any JWT whose `iat` predates this value.
    sessionsValidAfter: { type: Date, default: null },
  },
  { _id: false },
);

const billingSchema = new Schema(
  {
    stripeCustomerId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ['none', 'active', 'trialing', 'past_due', 'canceled'],
      default: 'none',
    },
    subscriptionTier: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
    currentPeriodEnd: { type: Date, default: null },
  },
  { _id: false },
);

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
    privacy: { type: privacySchema, default: () => ({}) },
    security: { type: securitySchema, default: () => ({}) },
    billing: { type: billingSchema, default: () => ({}) },
  },
  { timestamps: true, collection: 'users' },
);

// Note: no explicit `userSchema.index({ username: 1 })` — the `unique: true`
// constraint on the field already creates that index.

// Sparse-unique so the stripe webhook can resolve customer.id → user, while
// users with no Stripe customer yet are exempt from the unique constraint.
userSchema.index({ 'billing.stripeCustomerId': 1 }, { unique: true, sparse: true });

applySerialize(userSchema);

export type UserRow = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserRow>;
export const User = model('User', userSchema);
