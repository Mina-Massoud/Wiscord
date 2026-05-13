# Wiscord Frontend

Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui

## Required environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

**Redirect URL note:** Before testing magic-link sign-in, add
`http://localhost:5173/auth/callback` to your Supabase Dashboard under
**Authentication → URL Configuration → Redirect URLs**.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on `localhost:5173` |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Type-check only (no emit) |
| `npm run lint` | ESLint (zero warnings allowed) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run coverage` | Vitest with coverage |
| `npm run e2e` | Playwright E2E tests |
| `npm run e2e:ui` | Playwright UI mode |
| `npm run size` | Check bundle size budget |
