/**
 * Wire types for collaborative notes. Mirrors the shape returned by
 * GET /notes/mine on the backend — keep these in sync with
 * `backend/src/modules/notes/service.ts`.
 */

/**
 * One row in the labs index page. Mirrors `NotesSummary` on the
 * backend; keep both in sync.
 */
export interface NotesSummary {
  channelId: string;
  updatedAt: string;
  createdAt: string;
  updatedBy: string | null;
}

export interface NotesListResponse {
  docs: NotesSummary[];
}
