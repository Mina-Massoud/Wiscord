/**
 * Deterministic Gen Z funny title generator. Same seed → same title across
 * every render and every tab. Used anywhere a resource is missing a
 * human-readable name (untitled whiteboard, draft quiz, fresh room) — we
 * never expose raw IDs in user-facing copy. See the "no raw IDs" rule in
 * frontend/CLAUDE.md.
 *
 * Two-word `Adjective Noun` pairs, ~32 × 32 combinations. The hash is
 * FNV-1a so adjacent UUIDs land on different buckets and the same UUID
 * stays stable across reloads.
 */

const ADJECTIVES = [
  'Vibey',
  'Lowkey',
  'Highkey',
  'Based',
  'Sus',
  'Sigma',
  'Zesty',
  'Glowy',
  'Rizzy',
  'Iconic',
  'Goated',
  'Cheeky',
  'Spicy',
  'Cozy',
  'Feral',
  'Fluffy',
  'Dreamy',
  'Crispy',
  'Snazzy',
  'Wholesome',
  'Pixel',
  'Lucid',
  'Foggy',
  'Salty',
  'Minty',
  'Jazzy',
  'Snappy',
  'Sneaky',
  'Witty',
  'Mellow',
  'Plucky',
  'Funky',
] as const;

const NOUNS = [
  'Platypus',
  'Panda',
  'Pretzel',
  'Doodle',
  'Sketch',
  'Empire',
  'Studio',
  'Playground',
  'Manifesto',
  'Collage',
  'Remix',
  'Mural',
  'Workshop',
  'Atelier',
  'Lounge',
  'Arcade',
  'Galaxy',
  'Orbit',
  'Meadow',
  'Bunker',
  'Kitchen',
  'Cabin',
  'Treehouse',
  'Hideout',
  'Nebula',
  'Cosmos',
  'Beacon',
  'Lantern',
  'Spaceship',
  'Carousel',
  'Dojo',
  'Garden',
] as const;

function hash32(input: string): number {
  // FNV-1a 32-bit. Stable across runtimes, no deps.
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Two-word title like `Vibey Platypus`. Stable per seed. */
export function funnyTitle(seed: string): string {
  const h = hash32(seed);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[(h >>> 8) % NOUNS.length];
  return `${adj} ${noun}`;
}

/** Kebab-case form for filenames / slugs. `vibey-platypus`. */
export function funnyTitleSlug(seed: string): string {
  return funnyTitle(seed).toLowerCase().replace(/\s+/g, '-');
}

/**
 * Resolve a display name: real title if one exists, otherwise a deterministic
 * funny title from the seed. Use this at every render site that has both a
 * (possibly-null) human title and a stable id — never branch in component code.
 */
export function displayTitle(title: string | null | undefined, seed: string): string {
  const trimmed = title?.trim();
  if (trimmed) return trimmed;
  return funnyTitle(seed);
}
