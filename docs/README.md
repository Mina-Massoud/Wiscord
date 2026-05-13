# Wiscord — Project Context

Reference docs for the Wiscord build. Read these before starting any work in this repo.

- [overview.md](./overview.md) — product concept, target users, v1 scope, explicit out-of-scope list
- [stack.md](./stack.md) — frontend, backend, voice, AI, hosting; secrets-in-Edge-Functions rule
- [design.md](./design.md) — dark mode palette, four-tone layering, indigo accent, banned visual treatments
- [principles.md](./principles.md) — single product test, scope discipline, feel target

## TL;DR

A Discord-style collaborative study app. Topic-specific servers, channels with chat + voice + shared notes, synchronized Pomodoros, and a room-scoped AI assistant that answers questions from the channel's own context with citations. Built on React + Vite + Tailwind + shadcn/ui + Supabase + LiveKit + Anthropic, deployed to Vercel. Discord-inspired alpha design system — dark-native, blurple `#5865F2` accent, four-depth surface stack. v1 in roughly one month.
