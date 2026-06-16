/**
 * Generate a MongoDB ObjectId-shaped 24-char hex string on the client.
 *
 * An optimistically-inserted message carries this id from the moment it's
 * created, and the backend persists the message under the same id. That keeps
 * the React key stable across the optimistic → confirmed swap, so the message
 * node is never unmounted/remounted and auto-animate doesn't replay its enter
 * animation when the real message lands.
 *
 * We only need the *shape* of an ObjectId (24 hex chars, accepted by Mongoose's
 * `_id` cast) — not true ObjectId timestamp monotonicity — so 12 random bytes
 * rendered as hex is enough. Collisions across 2^96 space are not a concern.
 */
export function generateObjectId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
