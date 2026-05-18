# Wiscord Features — Explained

Each feature is a full-stack vertical slice. Tags: [DB] database · [RT] realtime · [AUTH] auth/authz · [UI] frontend · [AI] AI · [VO] voice.

## Servers

The Discord "guild" concept — top-level workspaces you join via invite.

- **Server list rail** — left-edge vertical strip of server icons; click switches the active server.
- **Create server (in-app)** — modal triggered from the rail (after onboarding) to spin up a new server you own.
- **Invite links — generate & revoke** — admin UI to mint redeemable invite tokens and kill stale ones (calls an RPC for the redeem path).
- **Leave / delete server** — confirm dialog; if the owner leaves, transfer ownership before delete.
- **Server settings** — rename, swap icon, manage active invites.

## Channels

Rooms inside a server, either text or voice.

- **Create channel** — pick text or voice, scoped to a server.
- **Channel sidebar** — second column listing channels grouped by type (text above, voice below).
- **Rename / delete channel** — gated by admin role checks in the channel service.
- **Channel switcher** — keyboard nav (e.g. ⌘K), unread dots next to channel names.

## Chat

The core text conversation surface.

- **Send & receive messages** — write to the `messages` collection, Socket.IO fans out a `message.created` event to other clients in the channel.
- **Message history** — older messages paginated as you scroll up.
- **Edit / delete own message** — soft delete (mark deleted, keep row) so threads don't fracture.
- **Markdown rendering** — bold, italic, inline code, fenced code, links.
- **Mentions** — `@username` autocomplete, highlight in message, notification entry for mentioned user.
- **Typing indicator** — ephemeral Socket.IO broadcast (no DB write); "Mina is typing…".
- **Reactions** — emoji picker per message, reaction counts sync in realtime.

## Pomodoro (Synchronized Timer)

The "heartbeat" feature — channel-wide focus timer everyone sees in sync.

- **Start session** — anyone can kick it off with a duration; persists to DB so latecomers see the running timer.
- **Set goal at start** — each user types a short "what I'll work on" before joining.
- **Live countdown** — server-stamped end time + Socket.IO tick, so all clients render the same remaining time (clock-skew safe).
- **End-of-session check-off** — when timer hits zero, prompt "did you hit your goal?" → boolean recorded.
- **Break timer** — auto-transitions into a shorter break phase, then loops.

## Presence

Who's around and what they're doing.

- **Status tracking** — three states: Focusing / On break / Idle.
- **Member panel** — right column grouping members by status.
- **Auto-status from Pomodoro** — joining a focus phase sets you to Focusing automatically.
- **Manual override** — user can force a status regardless of timer state.

## Voice Lounges

WebRTC voice chat via LiveKit.

- **Join / leave voice channel** — frontend fetches a short-lived JWT from the `POST /voice/token` Express endpoint (authz-gated), then connects.
- **Mute / unmute** — local track toggle, broadcast to room.
- **Speaking indicator** — visual ring around avatars actively transmitting.
- **Voice participant list** — who's currently connected to this lounge.

## Notes

A shared markdown scratchpad per channel for collaborative note-taking during study sessions.

- **TipTap rich editor** — headless ProseMirror editor styled with the Wiscord glass token system (`notes-prose.css`). StarterKit + Link + Placeholder enabled; markdown round-trip via `tiptap-markdown`. Bubble menu on selection (`@tiptap/react/menus`) for bold / italic / strike / inline code / link.
- **Yjs CRDT, not OT** — text sync goes through `Y.Doc` so concurrent writers never lose characters or jump each other's cursors. The Y.Doc is the source of truth; no parallel REST snapshot path can clobber it.
- **Realtime sync via Hocuspocus** — backend mounts a Hocuspocus server on the shared HTTP server at `/sync/notes/:channelId`. The upgrade gate (cookie-auth, Origin allowlist, UUID-shaped channelId) rejects unauthorized clients before the WS handshake completes. `onAuthenticate` pins the document name to the channelId from the verified cookie so a client can't swap to another channel's doc post-handshake.
- **Persistence** — `ChannelNotes` Mongoose model stores the Y.Doc as a Buffer (`Y.encodeStateAsUpdate`). Hocuspocus debounces store calls at 2s / max 10s. On reconnect, `onLoadDocument` applies the stored update into a fresh Y.Doc so the room rebuilds with full merge history.
- **Multi-cursor presence** — `CollaborationCaret` renders remote carets + name flags; cursor colour is the deterministic palette from `pickCursorColor(userId)` (shared with the whiteboard).
- **Last-edited-by indicator** — derived from Yjs awareness, debounced 500ms so cursor blinks don't flicker the pill. Footer card shows either "Maya is editing" with the peer's colour dot, or "You're the only one here" when no peers are connected.
- **Index + lab routes** — mirrors the whiteboard structure exactly. `/app/labs/notes` lists the docs the caller most recently edited (hero card + grid of `NotesBoardCard` tiles + sidebar of recents). `/app/labs/notes/:channelId` is the single-doc editor inside the standard app shell. Both DEV-only; both deleted when channels lands and Notes mounts as a tab inside the real channel route.
- **REST listing** — `GET /notes/mine` returns `{ docs: NotesSummary[] }` (channelId / updatedAt / createdAt / updatedBy), filtered to docs where `updatedBy === userId`. `DELETE /notes/:channelId` wipes the persisted Yjs doc; connected clients see a fresh empty doc on their next Hocuspocus reconnect.
- **Anti-double-blur** — the editor surface uses the project's glass tokens (`bg-glass-canvas`, `border-glass-border`) and intentionally never adds its own `backdrop-blur`; the app shell owns the only blur layer.

## Whiteboard

Per-channel collaborative canvas — pen, shapes, text, sticky notes — themed to the Wiscord glass shell.

- **tldraw canvas** — `@tldraw/sync` ships the editor + sync protocol; we wrap it in `wiscord-tldraw` so the canvas reads transparent over the wallpaper, with a dotted grid in muted ink and blurple selection rings.
- **Bottom-center toolbar** — glass dock with Select / Pen / Eraser / Shapes / Text / Sticky / Color / Undo / Redo / Export PNG. Replaces tldraw's stock chrome via `components` override.
- **Multi-cursor + presence** — native to `@tldraw/sync`; each user gets a deterministic cursor color from the `whiteboard.cursor.{1..8}` palette via `pickCursorColor(userId)`.
- **Realtime sync** — backend mounts a raw WebSocket gateway at `/sync/whiteboard/:channelId` alongside Socket.IO. Cookie-auth at upgrade, Origin allowlist, UUID-shaped channelId only.
- **Persistence** — `ChannelWhiteboard` Mongoose model stores the latest `RoomSnapshot` as JSON (one row per channel). Debounced flush at 2s of idle plus a 15s heartbeat ceiling while editing is active, plus a final flush when the last socket leaves.
- **Hand-written font** — Caveat (Google Fonts) wired into tldraw's text shapes + sticky notes. Loaded via the whiteboard CSS chunk only; non-whiteboard routes don't pay for it.
- **Cold-start hydration** — `GET /whiteboard/:channelId/snapshot` returns the latest persisted state for thumbnail / preview use cases; the live canvas relies on the WS handshake to paint state on connect.
- **Clear board** — `DELETE /whiteboard/:channelId` drops the in-memory room and removes the persisted row. Gated behind a confirm dialog in the labs sidebar; auth-only for now, host-gated when the channels module lands.
- **PNG export** — client-side via `editor.toImage(shapeIds, { format: 'png', background: false })`. Exports the full content bounds (not viewport) and writes a transparent-background PNG so the saved file isn't a dark rectangle.
- **Dev route** — `/app/labs/whiteboard/:channelId` (DEV-only); the inner `<WhiteboardCanvas>` mounts inside the real channel page's Whiteboard tab once channels lands.

## AI Assistant (Scoped — Personal first, Channel/Server/Voice later)

A Gemma 4 model (`gemma-4-26b-a4b-it`) on the Gemini API, scoped to a single "context surface" per request. Four planned scopes:

- **Personal (v1, shipping)** — surfaces as an option inside the Dynamic Island next to calendar / pomodoro. Tap the AI tick → the pill morphs into the AI card with a composer + streaming response area. Context = the caller's own notes (across channels), upcoming/recent calendar events, recent quiz attempts, recent voice activity. Used for "what was I doing last week," "summarise my IELTS notes," "what's next on my calendar."
- **Channel (later)** — composer in the chat tab; context = recent messages + the channel's shared notes + whiteboard captions. Same SSE endpoint, different context builder.
- **Server (later)** — context spans every channel in the server the caller has access to; used for "what's the server been focused on this week?"
- **Voice room (ready to wire)** — bound to the LiveKit room you're currently in; uses transient transcribed snippets + the room's pinned notes. Wired only after we have a live transcription source.

Common pieces:

- **Composer** — sparkle-prefixed input ("Ask…"). Sparkle icons are reserved for the AI surface itself per `frontend/CLAUDE.md`.
- **Context builder** — server-side, scope-keyed. Lean RAG: filter + sort + cap by `userId` (and `channelId` / `serverId` as scopes land). No embeddings in v1.
- **Streaming response** — `POST /ai/ask` Express endpoint, tokens streamed back over SSE. Frontend reads the same `{type:"token"|"done"|"error"}` event shape regardless of scope.
- **Citations** — the model is prompted to cite source ids inline; the UI renders them as clickable chips. Form is `[note:<channelId>]` / `[event:<id>]` / `[msg:<uuid>]` depending on which sources the scope's context builder yielded.
- **Context caching** — attempt Gemini context caching on the stable system + scope preamble; if Gemma rejects it, degrade silently and log once.

## Notifications

Unread tracking and attention signals.

- **In-app unread counts** — per channel and aggregated per server.
- **Mention badge** — distinct highlight when you're `@`-mentioned vs. generic unread.
- **Sound toggle** — opt-in chime on mention only.

## Layout & Navigation

The visual shell that holds everything.

- **Four-column shell** — server rail | channel sidebar | main pane (chat/notes) | members panel.
- **Responsive collapse** — sidebars hide on narrow viewports.
- **Theme tokens** — dark mode, blurple accent, four-tone background depth (see `docs/design.md`).
- **Keyboard shortcuts** — channel switch, focus composer, toggle mute.

## Infra & Polish

The cross-cutting hygiene that makes the rest trustworthy.

- **Authorization checks** — every read/write gated by server membership in the service layer; no unscoped find queries.
- **Toast system** — global toaster + `toast.success/error/info/loading` helpers (custom impl, not sonner — see `frontend/CLAUDE.md`).
- **Loading skeletons** — shape-matching skeletons for chat, members, notes (not generic spinners).
- **Empty states** — designed copy + CTA for "no servers yet", "no channels", "no messages".
- **E2E smoke tests** — Playwright covers invite → join → send message → start pomodoro.

---

Pick one full vertical and own it end-to-end (schema → authz checks → realtime wiring → UI → tests) before grabbing the next.
