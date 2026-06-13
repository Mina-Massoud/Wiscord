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
    stripeCustomerId: { type: String },
    /**
     * Stripe subscription id (`sub_...`) cached locally so the
     * auto-renew toggle and any future "update this sub" endpoint
     * don't need to round-trip Stripe to find it. Set by
     * `onSubscriptionChanged`; null while the user is Free.
     */
    subscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      // Mirrors Stripe's subscription statuses we explicitly track.
      // `incomplete` / `incomplete_expired` collapse to `canceled`
      // at the webhook layer — they mean "never successfully
      // charged" so the user gets free-tier behavior either way.
      enum: ['none', 'active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused'],
      default: 'none',
    },
    subscriptionTier: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
    currentPeriodEnd: { type: Date, default: null },
    /**
     * Mirrors Stripe's `subscription.cancel_at_period_end`. When
     * `true`, the user has clicked Cancel (in our toggle or the
     * Portal) but the period hasn't elapsed yet — `status` stays
     * `'active'` until Stripe fires `subscription.deleted` at
     * `currentPeriodEnd`. Without this field, the StatusBanner
     * would render "Renews on …" copy for a user who's actually
     * about to lose access, which is the bug that motivated
     * exposing the toggle in-app.
     */
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // scrypt hash (see lib/password.ts), self-describing `scrypt$N$salt$hash`.
    // `select: false` keeps it out of every default query — the sign-in path
    // is the only place that explicitly `.select('+passwordHash')`s it back in,
    // so it can never leak into a profile DTO or an accidental log line.
    passwordHash: { type: String, default: null, select: false },
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
    // Who the user is. Drives default `vibe` at onboarding and surfaces
    // role-specific copy in a few teacher-only spots (e.g. quiz authoring
    // hints). Locked to two values for v1 — `other` would force every
    // copy/AI vibe lookup into a fallback path and we'd rather force a
    // genuine choice than ship a half-cooked third register.
    role: {
      type: String,
      enum: ['student', 'teacher'],
      default: 'student',
    },
    // How Wiscord sounds — toasts, empty states, button labels, AND the
    // Wismate AI's prompt + few-shot prefill. Three discrete vibes so the
    // backend can keep N static AI prompt bundles (one per vibe) for
    // Gemini's implicit prefix cache. Per-role defaults: student → genz,
    // teacher → professional. User can override in settings.
    vibe: {
      type: String,
      enum: ['genz', 'chill', 'professional'],
      default: 'genz',
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
