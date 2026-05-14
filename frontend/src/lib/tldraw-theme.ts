/**
 * Wiscord-flavored bits for tldraw — deterministic cursor palette and
 * the small helpers the canvas component reaches for. The CSS variable
 * overrides live in `tldraw-theme.css` alongside this file.
 */

/**
 * Eight pre-tinted cursor colors that read against the glass dark
 * canvas without going neon. Mirrors the `whiteboard.cursor-{n}` token
 * group in `tailwind.config.ts`; keep them in sync if you ever rebalance
 * the palette.
 */
export const WISCORD_CURSOR_PALETTE: readonly string[] = [
  '#5865F2', // blurple
  '#EB459E', // hot pink
  '#57F287', // mint
  '#FEE75C', // sun
  '#F0B232', // amber
  '#23A55A', // moss
  '#9D6BFF', // ultraviolet
  '#3DDBD9', // teal
] as const;

/**
 * Stable, deterministic mapping from `userId` → cursor color. Same user
 * gets the same color across sessions, devices, and reconnects so the
 * presence pill stays recognizable to teammates. Collisions exist past
 * 8 distinct users — acceptable for v1.
 */
export function pickCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    // 31x + char is the classic Java-style string hash. Good enough for
    // a deterministic palette pick; we're not hashing for security.
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % WISCORD_CURSOR_PALETTE.length;
  return WISCORD_CURSOR_PALETTE[index] ?? WISCORD_CURSOR_PALETTE[0]!;
}
