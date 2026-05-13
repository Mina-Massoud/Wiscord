# Wiscord — Overview

Wiscord is a collaborative study app inspired by Discord's structure (servers → channels) but built specifically for studying. Users join topic-specific servers ("DSA Hub", "IELTS Prep", "Frontend Masters", "Med School"). Each server has text channels and voice lounges. The core loop: small groups join a channel, start a synchronized Pomodoro together, study in parallel while chatting or sitting in voice, and use a room-scoped AI assistant.

## One-line pitch

A Discord-style app where students join topic-specific rooms to study together with a synchronized timer and an AI assistant that knows what's happening in their room.

## Target users

Students, developers, and self-learners who struggle to focus alone and want body-doubling or accountability — LeetCode grinders, IELTS prep, frontend learners, med school students.

## The differentiator

Room-scoped AI assistant. **Pull-based only** (responds when asked, never proactive). Each channel has an "Ask anything about this room" input. The AI reads recent chat messages and current notes for that channel and answers with citations back to specific messages.

## v1 scope (one-month build)

- Auth, server creation, join via invite link
- Four-column layout: server rail / channel sidebar / main pane / member panel
- Real-time chat with persisted messages
- Synchronized Pomodoro per channel: anyone can start, each user sets a short goal at start, checks it off at end
- Live presence: Focusing / On break / Idle, grouped by status in the right panel
- Voice lounges: mute/unmute, see who's speaking. **Audio only** — no video, no screen share
- One collaborative notes doc per channel — shared textarea, real-time sync. Chat and notes are tabs in the main pane
- Room-scoped AI assistant (pull-based, with citations)

## Explicitly NOT in v1 (phase 2 or later)

- Quizzes
- Auto-generated summaries pushed without asking
- Productivity analytics dashboards
- Streaks
- Proactive AI nudges
- Inactive-member detection
- Voice notes
- Rich text editor for notes
- Native mobile app
- Custom emojis
- Complex roles / permissions
- DMs between users

## Why this scope

First version must be focused and shippable in roughly one month with a small team — not a feature-complete Discord + Notion + study-app clone.

## How to apply

When proposing features or scope changes, check against the out-of-scope list. Push back on requests that drift into phase 2. The guiding test for any feature: *"Does this make studying with others feel better than studying alone?"* If not, cut it. Prefer the smallest version that works.
