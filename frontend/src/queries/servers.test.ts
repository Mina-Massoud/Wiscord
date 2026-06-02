import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const createServerSchema = z.object({
  name: z.string().trim().min(2).max(64),
});

describe('create server form schema (client)', () => {
  it('accepts valid names', () => {
    expect(createServerSchema.parse({ name: 'DSA Hub' }).name).toBe('DSA Hub');
  });

  it('rejects single-character names', () => {
    expect(() => createServerSchema.parse({ name: 'a' })).toThrow();
  });
});
