# Wiscord — Features

Pick one. Each feature is full-stack: own the schema, the API, the realtime wiring, and the UI.

Legend: [DB] database · [RT] realtime · [AUTH] auth/RLS · [UI] frontend · [AI] AI · [VO] voice

---

## Servers
- **Server list rail** — left sidebar with all joined servers, switch active [UI]
- **Create server (in-app)** — modal/dialog from the rail, post-onboarding [DB] [UI]
- **Invite links — generate & revoke** — server settings UI + RPC [DB] [AUTH] [UI]
- **Leave / delete server** — with confirm + ownership transfer [DB] [UI]
- **Server settings** — rename, change icon, manage invites [DB] [UI]

## Channels
- **Create channel** — text or voice type, per server [DB] [UI]
- **Channel sidebar** — list channels grouped by type [UI]
- **Rename / delete channel** — admin only [DB] [AUTH] [UI]
- **Channel switcher** — keyboard nav, unread indicator [UI]

## Chat
- **Send & receive messages** — realtime via Supabase channel [DB] [RT] [UI]
- **Message history** — paginated load on scroll [DB] [UI]
- **Edit / delete own message** — soft delete [DB] [AUTH] [UI]
- **Markdown rendering** — bold, italic, code, links [UI]
- **Mentions** — @user with highlight + notification [DB] [RT] [UI]
- **Typing indicator** — ephemeral presence broadcast [RT] [UI]
- **Reactions** — emoji reactions on messages [DB] [RT] [UI]

## Pomodoro (Synchronized Timer)
- **Start session** — anyone in channel can start, sets duration [DB] [RT] [UI]
- **Set goal at start** — short text input per user [DB] [UI]
- **Live countdown** — synced across all clients in channel [RT] [UI]
- **End-of-session check-off** — did you hit your goal? [DB] [UI]
- **Break timer** — auto-rolls into break phase [RT] [UI]

## Presence
- **Status tracking** — Focusing / On break / Idle [DB] [RT]
- **Member panel** — right column, grouped by status [UI]
- **Auto-status from Pomodoro** — focus phase = Focusing [RT]
- **Manual override** — user can force status [UI]

## Voice Lounges
- **Join / leave voice channel** — LiveKit token from Edge Function [VO] [AUTH] [UI]
- **Mute / unmute** — local + broadcasted [VO] [UI]
- **Speaking indicator** — show who's talking [VO] [UI]
- **Voice participant list** — who's in the lounge [VO] [UI]

## Notes
- **Shared notes doc per channel** — single textarea, realtime sync [DB] [RT] [UI]
- **Tabs in main pane** — switch Chat / Notes [UI]
- **Last-edited-by indicator** — show whose cursor moved last [RT] [UI]
- **Notes autosave** — debounced write to DB [DB] [RT]

## AI Assistant (Room-Scoped)
- **Ask box per channel** — "Ask anything about this room" [AI] [UI]
- **Context builder** — pull recent N messages + notes for channel [AI] [DB]
- **Streaming response** — Claude Haiku via Edge Function [AI] [RT] [UI]
- **Citations** — answer links back to source message IDs [AI] [UI]
- **Prompt caching** — cache stable system + room context [AI]

## Notifications
- **In-app unread counts** — per channel + per server [DB] [RT] [UI]
- **Mention badge** — highlight when @mentioned [RT] [UI]
- **Sound toggle** — opt-in chime on mention [UI]

## Layout & Navigation
- **Four-column shell** — server rail / channel sidebar / main / members [UI]
- **Responsive collapse** — sidebars collapse on narrow screens [UI]
- **Theme tokens** — dark mode, indigo accent, four-tone bg [UI]
- **Keyboard shortcuts** — switch channel, focus composer, toggle mute [UI]

## Infra & Polish
- **RLS policies** — membership-gated reads/writes on all tables [AUTH] [DB]
- **Toast system** — global toaster + helpers for success/error [UI]
- **Loading skeletons** — chat, members, notes [UI]
- **Empty states** — no servers, no channels, no messages [UI]
- **E2E smoke tests** — invite, join, send message, start pomodoro [UI]

---

## How to claim

Drop your name next to a feature in this file, or open an issue titled `[feature] <name>`. Aim for one feature at a time end-to-end before grabbing another.
