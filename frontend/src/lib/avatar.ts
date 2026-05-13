/**
 * Deterministic GitHub-style identicon generator.
 * Pure function — no DOM, no Supabase, no React.
 * Returns a data:image/svg+xml;utf8,… URL.
 */

// ── Palette (dark-mode friendly, derived from design tokens) ────────────────

const PALETTE = [
  '#5865F2', // blurple
  '#57F287', // green
  '#FEE75C', // yellow
  '#9B59B6', // purple
  '#EB459E', // pink
] as const;

// ── FNV-1a 32-bit hash ───────────────────────────────────────────────────────

function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Multiply by FNV prime (32-bit): 0x01000193
    // Using bit-twiddling to stay within 32-bit unsigned range
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

// ── Identicon grid ───────────────────────────────────────────────────────────

/**
 * Generate a deterministic identicon SVG data URL from a seed string.
 *
 * @param seed - Any string (typically a user ID or username).
 * @param size - Rendered pixel size (default 80). The SVG viewBox is 5×5;
 *               the `size` just sets the width/height attribute.
 */
export function getIdenticonDataUrl(seed: string, size = 80): string {
  const hash = fnv1a32(seed);

  // Pick foreground colour from palette
  const fg = PALETTE[Math.abs(hash) % PALETTE.length] ?? PALETTE[0];
  const bg = '#1e1f22'; // near-black surface — matches dark canvas token

  // Build a 5-column × 5-row grid mirrored across the vertical axis.
  // We need 3 unique columns (left, centre, right = mirror of left).
  // That's 3 × 5 = 15 bits; we can pull them from the hash.
  const cells: boolean[][] = [];
  let bits = hash;

  for (let row = 0; row < 5; row++) {
    const rowCells: boolean[] = [];
    for (let col = 0; col < 3; col++) {
      rowCells.push((bits & 1) === 1);
      bits >>= 1;
    }
    // Mirror: col 3 = col 1, col 4 = col 0
    cells.push([rowCells[0], rowCells[1], rowCells[2], rowCells[1], rowCells[0]]);
  }

  // Build <rect> elements for filled cells
  const rects: string[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (cells[row]?.[col]) {
        rects.push(`<rect x="${col}" y="${row}" width="1" height="1" fill="${fg}"/>`);
      }
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${size}" height="${size}" viewBox="0 0 5 5">`,
    `<rect width="5" height="5" fill="${bg}"/>`,
    ...rects,
    `</svg>`,
  ].join('');

  // URL-encode minimal set of characters that break data URIs
  const encoded = svg
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/"/g, "'");

  return `data:image/svg+xml;utf8,${encoded}`;
}
