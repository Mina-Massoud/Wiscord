# Whiteboard — Implementation Plan

> **Owner:** Mina
> **Drafted:** 2026-05-14
> **Status:** Phases 1–6 shipped behind `/app/labs/whiteboard/:channelId` (DEV-only). Phase 7 (tests + E2E) pending.

Supersedes the Whiteboard section in [`docs/plans/voice-notes-whiteboard.md`](./voice-notes-whiteboard.md).

## Tech decision

**`@tldraw/sync` (no Yjs).** tldraw's first-party sync server runs `TLSocketRoom` with its own WebSocket protocol — simpler than gluing tldraw to a separate Yjs server, and a smaller integration surface for v1.

Trade: if Notes later ships with Yjs (Y.Text), it gets its own realtime server rather than sharing this one. That's fine — the persistence layer (a JSON snapshot per channel) is portable, and we revisit shared infra only if we end up with three Yjs-based features.

## Architecture

```
Browser                                  Backend
─────────                                ──────────
<Tldraw store={useSync({uri})} />   ←—→  /sync/whiteboard/:channelId  (raw WS)
                                             ├── cookie auth at upgrade
                                             ├── Origin allowlist
                                             ├── TLSocketRoom (in-memory)
                                             └── debounced + heartbeat flush

GET  /whiteboard/:channelId/snapshot ←—→  whiteboardRouter (Express)
DELETE /whiteboard/:channelId        ←—→  whiteboardRouter (Express)

                                         ChannelWhiteboard (Mongoose)
                                             { channelId, snapshot (JSON),
                                               lastEditorId, updatedAt }
```

The WS sits on the *same* HTTP server as Socket.IO. Both register `upgrade` listeners; each checks `req.url`'s path prefix and only consumes its own sockets:

- `/realtime/*` → Socket.IO (existing)
- `/sync/whiteboard/*` → tldraw sync (new)
- anything else → no-op (closed by `notFoundHandler` for HTTP)

## File map

### Backend
- `src/db/models/ChannelWhiteboard.ts` — Mongoose model.
- `src/modules/whiteboard/snapshot-store.ts` — pure Mongo I/O.
- `src/modules/whiteboard/room-registry.ts` — per-process `Map<channelId, TLSocketRoom>` with debounce/heartbeat.
- `src/modules/whiteboard/sync-gateway.ts` — `WebSocketServer({ noServer: true })` + `upgrade` handler.
- `src/modules/whiteboard/{routes,service,schemas}.ts` — HTTP module, mirrors voice/quiz.
- `src/app.ts` — `app.use('/whiteboard', whiteboardRouter)`.
- `src/server.ts` — boots the sync gateway, flushes dirty rooms on shutdown.

### Frontend
- `src/types/whiteboard.ts` — wire types.
- `src/queries/whiteboard.ts` — `useWhiteboardSnapshot` + `useClearWhiteboard`.
- `src/queries/keys.ts` — added `whiteboard` namespace.
- `src/lib/tldraw-theme.css` — CSS-var overrides, scoped to `.wiscord-tldraw`. Imports Caveat + `tldraw/tldraw.css`.
- `src/lib/tldraw-theme.ts` — `WISCORD_CURSOR_PALETTE` + `pickCursorColor(userId)`.
- `src/components/whiteboard/WhiteboardCanvas.tsx` — `<Tldraw>` wrapper.
- `src/components/whiteboard/WhiteboardToolbar.tsx` — bottom-center glass dock.
- `src/components/whiteboard/WhiteboardColorSwatch.tsx` — Evernote-style swatch popover.
- `src/components/whiteboard/LabsWhiteboardSidebar.tsx` — labs sidebar with Clear-board confirm.
- `src/components/whiteboard/useExportPng.ts` — PNG export hook (full content bounds, transparent bg).
- `src/pages/app/labs/WhiteboardLabPage.tsx` — page composition (mirrors VoiceLabPage).
- `src/App.tsx` — DEV-only route registration.
- `tailwind.config.ts` — `fontFamily.handwritten`, `colors.whiteboard.cursor.{1..8}` palette, canvas-tint / grid-dot tokens.

## Persistence model

```ts
ChannelWhiteboard {
  channelId: string  (UUID, unique)
  snapshot: string   (JSON-serialized RoomSnapshot)
  lastEditorId: string
  createdAt / updatedAt
}
```

- One row per channel (no history in v1).
- Snapshot stored as String, not Buffer — JSON stays grep-able in the mongo shell and stays well under the 16 MB doc limit (typical board < 1 MB).
- Persistence runs **only** from the `room-registry`'s debounced flush — never from REST. The HTTP `service.ts` is read-only / destructive-only.

## Realtime invariants

1. **Auth at upgrade.** No anonymous sockets reach `TLSocketRoom` — we write `HTTP/1.1 401 Unauthorized` to the raw stream and destroy the socket before `wss.handleUpgrade`.
2. **Origin allowlist.** `req.headers.origin === env.FRONTEND_ORIGIN` or we reject 403. Raw WS has no built-in CORS check.
3. **Lazy rooms.** A `TLSocketRoom` is only constructed when the first client connects; the initial snapshot is loaded from Mongo at that point.
4. **Flush on last-leave.** When `onSessionRemoved` reports `numSessionsRemaining === 0`, we flush whatever's dirty and `room.close()` — the next reconnect starts fresh.
5. **Idempotent shutdown.** `server.ts`'s SIGINT/SIGTERM handler calls `whiteboardGateway.stop()` which awaits all in-flight flushes.

## Design integration

- Canvas paints **transparent** so the wallpaper bleeds through (`.wiscord-tldraw { background: transparent }` + `--tl-color-background: transparent`).
- Dotted grid at `rgba(255,255,255,0.06)` — texture, not a grid sheet.
- Selection rings + cursor halos in `var(--blurple)`.
- Text shapes and sticky notes default to **Caveat** (handwritten, Gen-Z friendly) via `--tl-font-draw`. Caveat ships in the whiteboard CSS chunk only, so non-whiteboard routes don't pay for it.
- Cursor colors come from `whiteboard.cursor.{1..8}` (defined in `tailwind.config.ts`), hashed deterministically from `userId` so the same user is always the same color.

## Bundle impact

- Initial app bundle: **130 KB gzip** (target: ≤150 KB). ✅
- WhiteboardLabPage chunk: **481 KB gzip** (tldraw + sync). Loaded only when the user navigates to the whiteboard. ✅
- WhiteboardLabPage CSS: **15 KB gzip** (Caveat + tldraw default styles).

## What's stubbed

- **Channel membership.** Both the WS upgrade and `DELETE /whiteboard/:channelId` only check that the user is signed in. When the channels module ships, the TODO in `sync-gateway.ts` and `service.ts` flips to a real `Membership.findOne({ userId, channelId })` check.
- **Image uploads.** `WhiteboardCanvas`'s asset store rejects uploads. v2 adds an `/assets` endpoint backed by the storage driver.
- **Snapshot history.** Single latest row per channel — no scrub-back UI.

## Phase 7 — pending

Tests + polish, not yet written:
- Backend HTTP: `tests/whiteboard.test.ts` (unauth → 401, valid GET, valid DELETE, invalid UUID → 400).
- Backend WS: smoke test that an authenticated upgrade returns 101 and an anonymous one returns 401.
- Frontend component: `WhiteboardToolbar.test.tsx` keyboard-nav + tool-pressed-state.
- Frontend E2E (Playwright): two-context drawing test, PNG export download assertion.

## Open questions / handoff

- Confirm `useParams<{ channelId: string }>()` stays the channelId seam when the channels module lands.
- Decide whether v2 wants snapshot history (separate collection, periodic write) or sticks with latest-only.
