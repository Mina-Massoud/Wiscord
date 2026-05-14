/**
 * Mirror of `frontend/src/lib/tldraw-theme.ts` so headless load-test
 * clients show up with the same deterministic cursor color the real
 * frontend would assign them. Same hash, same palette, same indices —
 * keep both files in sync if you ever rebalance the palette.
 */

const WISCORD_CURSOR_PALETTE: readonly string[] = [
  '#5865F2',
  '#EB459E',
  '#57F287',
  '#FEE75C',
  '#F0B232',
  '#23A55A',
  '#9D6BFF',
  '#3DDBD9',
] as const;

export function pickCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % WISCORD_CURSOR_PALETTE.length;
  return WISCORD_CURSOR_PALETTE[index] ?? WISCORD_CURSOR_PALETTE[0]!;
}
