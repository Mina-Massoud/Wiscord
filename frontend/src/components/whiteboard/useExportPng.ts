import { useCallback, useState } from 'react';
import type { Editor } from 'tldraw';

import { funnyTitleSlug } from '@/lib/funny-title';

/**
 * Triggers a PNG download of the current page's full content bounds.
 *
 * Two opinionated choices baked in:
 *   - **Full content, not viewport.** `editor.getCurrentPageShapeIds()`
 *     captures every shape regardless of scroll/zoom, so the saved file
 *     never depends on what the user happened to be looking at.
 *   - **Transparent background.** The Wiscord canvas reads as glass on
 *     a wallpaper; baking a dark fill into the export would look wrong
 *     when re-opened anywhere else. `background: false` keeps the PNG
 *     honest — open it in Preview and you see only the strokes.
 *
 * Filename: `wiscord-whiteboard-<slug>-<ISO timestamp>.png`. The slug
 * is the channel id's last 6 chars (matches the title-bar label).
 */
export function useExportPng(
  editor: Editor,
  channelId: string,
): { exportPng: () => Promise<void>; isExporting: boolean } {
  const [isExporting, setIsExporting] = useState(false);

  const exportPng = useCallback(async () => {
    setIsExporting(true);
    let blobUrl: string | null = null;
    try {
      const shapeIds = Array.from(editor.getCurrentPageShapeIds());
      if (shapeIds.length === 0) {
        throw new Error('Nothing to export yet — draw something first.');
      }
      const result = await editor.toImage(shapeIds, {
        format: 'png',
        background: false,
      });
      blobUrl = URL.createObjectURL(result.blob);

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const slug = funnyTitleSlug(channelId);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `wiscord-whiteboard-${slug}-${stamp}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      setIsExporting(false);
      if (blobUrl) {
        // Some browsers race the download if we revoke synchronously.
        // A short delay lets the click handler complete its read.
        window.setTimeout(() => {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
        }, 1000);
      }
    }
  }, [editor, channelId]);

  return { exportPng, isExporting };
}
