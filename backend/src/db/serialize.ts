import type { Schema } from 'mongoose';

/**
 * Apply to every schema. Strips `_id` / `__v` from JSON output and exposes
 * a stable `id` string instead. The API surface always speaks `id`.
 */
export function applySerialize(schema: Schema): void {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      if (ret._id) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      return ret;
    },
  });
  schema.set('toObject', { virtuals: true });
}
