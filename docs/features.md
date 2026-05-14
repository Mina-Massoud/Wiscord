# Wiscord — Features

Pick one. Each feature is full-stack: own the schema, the API, the realtime wiring, and the UI.

Legend: [DB] database · [RT] realtime · [AUTH] auth/authz · [UI] frontend · [AI] AI · [VO] voice

A few features need a non-obvious external library choice — those have a **Recommended tech** block. Everything else is built with what's already in [stack.md](./stack.md) (Node + Express + Mongoose, React + Vite, Tailwind + shadcn/ui).

---

## Servers

- **Server list rail** — left sidebar with all joined servers, switch active [UI]
- **Create server (in-app)** — modal/dialog from the rail, post-onboarding [DB] [UI]
- **Invite links — generate & revoke** — server settings UI + RPC [DB] [AUTH] [UI]
- **Leave / delete server** — with confirm + ownership transfer [DB] [UI]
- **Server settings** — rename, change icon, manage invites [DB] [UI]

---

## Channels

- **Create channel** — text or voice type, per server [DB] [UI]
- **Channel sidebar** — list channels grouped by type [UI]
- **Rename / delete channel** — admin only [DB] [AUTH] [UI]
- **Channel switcher** — keyboard nav, unread indicator [UI]

**Recommended tech**
- **⌘K palette:** [`cmdk`](https://cmdk.paco.me) — small, accessible, headless. Hand-roll the rest of our hotkeys.

---

## Chat

- **Send & receive messages** — realtime via Socket.IO event fan-out [DB] [RT] [UI]
- **Message history** — paginated load on scroll [DB] [UI]
- **Edit / delete own message** — soft delete [DB] [AUTH] [UI]
- **Markdown rendering** — bold, italic, code, links [UI]
- **Mentions** — @user with highlight + notification [DB] [RT] [UI]
- **Typing indicator** — ephemeral presence broadcast [RT] [UI]
- **Reactions** — emoji reactions on messages [DB] [RT] [UI]

**Recommended tech**
- **Realtime transport: Socket.IO** (`socket.io` + `socket.io-client`). Why: built-in rooms map 1:1 to channels, auto-reconnect and ack handling are free, cookie auth slots into Express middleware. The alternative is raw `ws` — smaller wire, but we'd rebuild rooms/reconnect/ack ourselves. Managed services (Pusher, Ably, Liveblocks) cost per concurrent connection and the hard parts (auth, persistence) still live in our server anyway, so they don't buy us much.
- **Markdown:** `react-markdown` + `remark-gfm` + `rehype-sanitize`. Never `dangerouslySetInnerHTML`.

---

## Pomodoro (Synchronized Timer)

- **Start session** — anyone in channel can start, sets duration [DB] [RT] [UI]
- **Set goal at start** — short text input per user [DB] [UI]
- **Live countdown** — synced across all clients in channel [RT] [UI]
- **End-of-session check-off** — did you hit your goal? [DB] [UI]
- **Break timer** — auto-rolls into break phase [RT] [UI]

---

## Presence

- **Status tracking** — Focusing / On break / Idle [DB] [RT]
- **Member panel** — right column, grouped by status [UI]
- **Auto-status from Pomodoro** — focus phase = Focusing [RT]
- **Manual override** — user can force status [UI]

**Recommended tech**
- **Realtime transport: Socket.IO** — reuse the same connection as Chat. The connection lifecycle itself *is* the source of truth: `connection` marks the user online, `disconnect` marks them offline. Status changes (Focusing / On break / Idle) emit as events into the server's room so every member panel updates in real time. No polling.

---

## Voice Lounges

- **Join / leave voice channel** — LiveKit token minted by Express endpoint [VO] [AUTH] [UI]
- **Mute / unmute** — local + broadcasted [VO] [UI]
- **Speaking indicator** — show who's talking [VO] [UI]
- **Voice participant list** — who's in the lounge [VO] [UI]

**Recommended tech**
- **Media server: LiveKit Cloud** (already chosen). Free tier covers MVP. Managed SFU — no TURN servers, no codec wars. Self-host LiveKit OSS later only if cost forces it.
- **Server SDK:** `livekit-server-sdk` for minting room-scoped JWTs from our Express endpoint. `LIVEKIT_API_SECRET` never leaves the server.
- **Client SDK:** `@livekit/components-react` — opinionated React components for join/leave/mute/speaking. Cuts implementation effort to near-zero.

---

## Notes

- **Shared notes doc per channel** — single textarea, realtime sync [DB] [RT] [UI]
- **Tabs in main pane** — switch Chat / Notes / Whiteboard [UI]
- **Last-edited-by indicator** — show whose cursor moved last [RT] [UI]
- **Notes autosave** — debounced write to DB [DB] [RT]

**Recommended tech**
- **Conflict-free editing: Yjs** (`yjs` + `y-websocket`). Why: a multi-writer textarea is CRDT territory — "broadcast the full string" causes cursor jumps and lost characters on concurrent edits. Yjs is the de-facto open-source CRDT for collaborative text. MIT, no service dependency.
- **Why not Socket.IO + diffs?** OT without a CRDT is hard to get right — you end up rebuilding Yjs badly.
- **Managed alternative: Liveblocks** if Yjs ops get annoying. Same mental model, paid SaaS, mechanical swap.

---

## Whiteboard

- **Shared whiteboard per channel** — pen, shapes, text, sticky notes, realtime sync [DB] [RT] [UI]
- **Multi-cursor** — see other users' pointers as they draw [RT] [UI]
- **Tool palette** — pen, eraser, shapes, text, color picker [UI]
- **Whiteboard autosave** — debounced snapshot to DB [DB] [RT]
- **Export snapshot** — download the board as PNG [UI]

**Recommended tech**
- **Editor: [tldraw](https://tldraw.dev)** (`@tldraw/tldraw`). MIT, built for embedding into apps, ships a gorgeous out-of-the-box UI with infinite canvas, shape primitives, tool palette, and undo/redo. Saves us months of building canvas + pointer + serialization from scratch.
- **Sync: Yjs** via `@tldraw/sync` — tldraw's collaboration layer is Yjs-compatible, so we reuse the same `y-websocket` server as Notes on a per-channel whiteboard doc. One realtime layer, two features.
- **Why not Excalidraw?** Excalidraw is more "embed our whole app" than "compose with ours". tldraw is purpose-built for app integration.

---

## AI Assistant (Room-Scoped)

- **Ask box per channel** — "Ask anything about this room" [AI] [UI]
- **Context builder** — pull recent N messages + notes for channel [AI] [DB]
- **Streaming response** — Claude Haiku via Express SSE endpoint [AI] [RT] [UI]
- **Citations** — answer links back to source message IDs [AI] [UI]
- **Prompt caching** — cache stable system + room context [AI]

**Recommended tech**
- **Model: Claude Haiku 4.5** via the official `@anthropic-ai/sdk`. Room-scoped questions are small-context and latency-sensitive — no need for Opus. ~3× cheaper, ~2× faster for this prompt shape.
- **Transport: Server-Sent Events (SSE), not Socket.IO.** The stream is one-way (server → client), trivial to debug with `curl`, and the Anthropic streaming response is already an SSE-shaped event stream. Socket.IO adds room semantics we don't need.
- **Prompt caching:** Anthropic's `cache_control: { type: 'ephemeral' }` on the system prompt + channel-context preamble. ~90% cost cut on repeat asks within the 5-minute TTL.

---

## Notifications

- **In-app unread counts** — per channel + per server [DB] [RT] [UI]
- **Mention badge** — highlight when @mentioned [RT] [UI]
- **Sound toggle** — opt-in chime on mention [UI]

---

## Layout & Navigation

- **Four-column shell** — server rail / channel sidebar / main / members [UI]
- **Responsive collapse** — sidebars collapse on narrow screens [UI]
- **Theme tokens** — dark mode, indigo accent, four-tone bg [UI]
- **Keyboard shortcuts** — switch channel, focus composer, toggle mute [UI]

**Recommended tech**
- **List animations:** [`@formkit/auto-animate`](https://auto-animate.formkit.com) — drop-in for the channel/member/message lists. Honors `prefers-reduced-motion` natively.
- **Sequenced motion:** Framer Motion **only** where orchestration is needed (modals, Pomodoro completion). CSS transitions for everything else.

---

## Infra & Polish

- **Authorization checks** — membership-gated reads/writes enforced in every service module [AUTH] [DB]
- **Toast system** — global toaster + helpers for success/error [UI]
- **Loading skeletons** — chat, members, notes [UI]
- **Empty states** — no servers, no channels, no messages [UI]
- **E2E smoke tests** — invite, join, send message, start pomodoro [UI]

**Recommended tech**
- **E2E:** Playwright. One happy-path smoke test: invite → join → send message → start pomodoro.
- **Authz:** explicit middleware + service-layer checks. Don't reach for `casl` / `accesscontrol` — the rules are simple enough that explicit code is clearer and easier to audit.

---

## How to claim

Drop your name next to a feature in this file, or open an issue titled `[feature] <name>`. Aim for one feature at a time end-to-end before grabbing another.
