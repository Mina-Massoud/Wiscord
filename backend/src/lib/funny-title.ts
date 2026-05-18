/**
 * Deterministic Gen-Z funny title generator. Mirrors
 * `frontend/src/lib/funny-title.ts` — same seed → same title on
 * both sides of the wire. FNV-1a hash so adjacent UUIDs land on
 * different buckets and the same id stays stable across calls.
 *
 * Lives in the backend so the AI `sources` payload can emit
 * human-readable labels for resources that have no real title
 * (untitled notes, draft quizzes) without exposing raw ids.
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
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function funnyTitle(seed: string): string {
  const h = hash32(seed);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[(h >>> 8) % NOUNS.length];
  return `${adj} ${noun}`;
}
