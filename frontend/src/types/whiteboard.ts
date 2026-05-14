/**
 * Wire types for the whiteboard. Mirrors the shape returned by
 * GET /whiteboard/:channelId/snapshot on the backend — keep these
 * in sync with `backend/src/modules/whiteboard/service.ts`.
 */

export interface WhiteboardSnapshotResponse {
  /** Latest committed RoomSnapshot encoded as base64, or null when empty. */
  snapshot: string | null;
  updatedAt: string | null;
  lastEditorId: string | null;
}

/** Identity payload we feed into the sync store for presence/awareness. */
export interface WhiteboardIdentity {
  userId: string;
  displayName: string;
  /** One of `whiteboard.cursor-1` … `whiteboard.cursor-8` (hex). */
  color: string;
}
