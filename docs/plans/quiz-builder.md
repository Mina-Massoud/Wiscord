# Quiz Builder & Live/Async Quiz Player

> **Owner:** Mina
> **Drafted:** 2026-05-13
> **Status:** Design — awaiting approval before implementation.
> **Sibling plan:** [`voice-notes-whiteboard.md`](./voice-notes-whiteboard.md) — same `/labs/*` strategy, same channel-team handoff plan.

## Context

A host inside a study channel needs to author a quiz and run it for the channel — either **live** (Kahoot-style: timed, synchronized, with a leaderboard) or **async** (homework: take any time, host watches results). Quizzes are a study aid, not an assessment platform — the bar is "does it help a study group review what they just covered together," not "does it grade a midterm."

The channel module isn't shipped yet (same situation as voice/notes/whiteboard), so v1 lives at `/labs/quiz/:channelId` behind the dev-only labs route gate. The components remount inside the real channel page as a Quiz tab on handoff with no rewrites — same playbook as voice.

## Scope (confirmed)

- **Question types**: MCQ-single, MCQ-multi, True/False, Short answer (free text, host grades after).
- **Delivery modes**: Live and Async, host picks per-quiz at launch time.
- **Surface**: standalone `/labs/quiz/:channelId` page now; channel-tab integration after handoff.

### Out of scope (v1)

- Question banks / cross-channel reuse
- Image-attached questions (Kajabi/Maze do this — not a v1 study need; can graft on later via the existing image upload path)
- Auto-graded short answer (regex / fuzzy match) — host grades manually in the results dashboard
- Quiz analytics beyond per-attempt results (no aggregate "Question 3 was hardest" view)
- Anonymous quizzes — every attempt is tied to an authenticated user
- Cross-channel leaderboards / streaks / XP

## Design references (Mobbin)

| Pattern | Lift |
|---|---|
| **Maze — 3-pane builder** ([screen](https://mobbin.com/screens/43596365-445e-4231-b020-fce1d1e201b7)) | Question-list rail + editor + live preview rail. The right-side preview is the highest-leverage thing to copy — the host sees exactly what the participant will see, no "press preview button" friction. |
| **Whop — compact options row** ([screen](https://mobbin.com/screens/0e6704cd-1239-4b9a-bc85-a5fc1a5f80fe)) | Drag handle ▸ option text ▸ "correct" check ▸ delete. Tightest editing footprint we've seen. |
| **Kajabi — minimal question card** ([screen](https://mobbin.com/screens/7d414a1b-f369-4d64-908e-731cd1fbf590)) | Single card on a near-empty canvas, "Add question" CTA below. We follow this rhythm — one card per question, no nested borders. |
| **Kajabi — A/B/C/D answer tiles** ([screen](https://mobbin.com/screens/ad0c9807-f0e6-44ef-a842-9c66b038d6cc)) | Participant view: big letter-chip tiles, single column, big tap targets, screen-reader friendly. |
| **Udemy — per-answer explanation** ([screen](https://mobbin.com/screens/9d2d7e67-cd9c-4d7b-a76b-36980b5c351b)) | Optional explanation under each option turns a quiz into a learning loop — vital for a study app. Lift the *idea*, drop the rich-text editor (overkill). |

Patterns we deliberately **don't** copy:

- Maze's "Welcome / Thank You / Rejection" screener blocks — that's a survey product, we're a study-quiz product.
- Whop's drip-feed / completion-percentage chrome — irrelevant for v1.
- Rich-text editors anywhere — pointless for a 200-character question prompt.

## Strategy alignment

Same as the voice plan:

- **Backend** module under `backend/src/modules/quiz/` with the same `routes/service/schemas` shape; Mongoose models for `Quiz` and `QuizAttempt`; `requireAuth` everywhere; Zod input parsing; `ok()` envelope. Realtime over the existing Socket.IO server (no new infra).
- **Frontend** queries under `src/queries/quiz.ts` (mutations + queries hierarchical via `qk.quiz.*`). One `useQuizSocket` wrapper hook for the live-mode events. All UI under `src/pages/app/labs/QuizLabPage.tsx` + `src/components/quiz/*`.
- **No Supabase**. Period.
- `useChannelId()` reads from `useParams<{ channelId: string }>()` today; swaps to `ChannelContext` after handoff. Same seam.

---

## Information architecture

```
/labs/quiz/:channelId
├── (no quiz selected)         → empty-state CTA: "Build the channel's first quiz"
├── ?quiz=<id>                 → builder OR results view depending on quiz status
└── ?quiz=<id>&play=1          → participant player (host sees host-control overlay)
```

Single page, four URL-driven states. No client routes inside the page.

```
┌─ ServerRail ─┬─ QuizSidebar ─────────┬─ QuizMain ────────────────────────────┬─ PreviewRail ─┐
│   (existing) │ Channel · Quizzes      │  Builder | Player | Results          │  Live preview │
│              │ ─────────────────────  │  (URL-state-driven)                  │   (host only) │
│              │ + New quiz             │                                      │               │
│              │ • Quiz title  · status │                                      │               │
│              │ • …                    │                                      │               │
└──────────────┴─ UserPanel ────────────┴──────────────────────────────────────┴───────────────┘
```

Reuses `AppShellLayout` exactly — same slots as `VoiceLabPage`. The right rail swaps `ActiveNowPanel` for the live preview panel on the builder screen, falls back to `ActiveNowPanel` on the participant player screen.

---

## Screen 1 — Quiz Sidebar

Lives in the `sidebar` slot. Shape mirrors `LabsChannelSidebar`:

- Header: `Labs · Quiz` (`text-control font-semibold`).
- Section label: `QUIZZES` (`text-badge text-ink-subtle`, uppercase, tracking-wider).
- New-quiz button: `+ New quiz`, ghost variant, full-width row.
- Quiz rows: title (`text-tab`) + status pill (`Draft` / `Live · 12 in` / `Closed · 8 attempts`).
- Active row: `bg-surface-active`. Hover: `bg-surface-hover`. Same row treatment as channels.

No nested borders. `surface-chrome` background per the four-depth stack.

---

## Screen 2 — Builder (host)

URL: `?quiz=<id>` and quiz status is `draft`.

### Layout

Two columns inside `main` — the question list (left, ~280px) and the editor (right, fluid). The shell's right rail shows the live preview.

```
┌─ Question list ─┬─ Editor ──────────────────────────────────────────┐
│ ⋮⋮ Q1 MCQ      │ Question type ▾   [Single]                          │
│    "What is …"  │                                                     │
│ ⋮⋮ Q2 T/F      │ Prompt                                              │
│    "Did Plato…" │ ┌─────────────────────────────────────────────┐   │
│ ⋮⋮ Q3 SHORT    │ │ The mitochondria is the …                    │   │
│    "Explain…"   │ └─────────────────────────────────────────────┘   │
│                 │                                                     │
│ + Add question  │ Options                                             │
│                 │ ⋮⋮ ☑ Powerhouse of the cell        ✎ explain  🗑   │
│                 │ ⋮⋮ ☐ Energy storage                  ✎ explain  🗑   │
│                 │ ⋮⋮ ☐ Protein factory                 ✎ explain  🗑   │
│                 │ + Add option                                        │
│                 │                                                     │
│                 │ ── Quiz settings (collapsible) ──                  │
│                 │ Time per question · 30s | 60s | none                │
│                 │ Shuffle questions  ◯                                │
│                 │ Shuffle options    ◯                                │
└─────────────────┴─────────────────────────────────────────────────────┘
```

### Editor variants by question type

All four variants share the prompt + settings frame; only the answer surface changes.

| Type | Answer surface |
|---|---|
| **MCQ-single** | Radio + option rows; one correct. Re-uses Whop layout. |
| **MCQ-multi** | Checkbox + option rows; ≥ 1 correct, validated client-side. |
| **True / False** | Two locked rows (`True`, `False`); host picks the correct one. |
| **Short answer** | No options. A single "Reference answer" textarea (visible to host only at grade time, never to participants). Helper copy: *"Participants type a free response. You'll grade attempts after the quiz closes."* |

### Per-option "explain" affordance

Click `✎ explain` to expand a one-line input under the option:

> *"Optional. Shown to the participant after the question is answered."*

Lifts the Udemy idea, dropped to a single line — a study-app explanation is a sentence, not an essay.

### Live preview rail (right)

A phone-frame card on `surface-callout`, ~320px wide, matching exactly what the participant will see. Updates on every keystroke (no preview button). Shows the current question being edited. The frame's chrome is the only place we draw the participant tile background and CTA — keeps the host's mental model honest.

> *Why this matters:* the Maze pattern is the single biggest leverage point in their builder UX — host confidence collapses when "preview" is a separate destination. This is the one place we lift their pattern verbatim.

### Validation

- Prompt required (1–500 chars).
- MCQ-single: ≥ 2 options, exactly 1 correct.
- MCQ-multi: ≥ 2 options, ≥ 1 correct.
- True/False: correct must be set.
- Short answer: nothing required beyond prompt; reference answer optional.
- Quiz must have ≥ 1 valid question to launch.

Errors surface inline next to the offending field per the Forms rule. Toast on launch attempt with invalid quiz: *"Fix the highlighted questions before launching."*

### Buttons

- Header right: `Save draft` (ghost) auto-fires on debounce; manual click is a tap-target safety net.
- Header right: `Launch quiz` (primary, blurple) — disabled until quiz is valid. Opens the launch dialog.

### File layout

```
frontend/src/components/quiz/
├── QuizBuilder.tsx              # Top-level builder layout (list + editor)
├── QuizQuestionList.tsx         # Sortable list of questions, "Add question"
├── QuizQuestionEditor.tsx       # Switches on question type → variant editor
├── editors/
│   ├── McqSingleEditor.tsx
│   ├── McqMultiEditor.tsx
│   ├── TrueFalseEditor.tsx
│   └── ShortAnswerEditor.tsx
├── QuizOptionRow.tsx            # Drag handle + text + correct + explain + delete
├── QuizSettingsPanel.tsx        # Time, shuffle, etc.
├── QuizLivePreview.tsx          # Right-rail preview frame
└── QuizLaunchDialog.tsx         # Launch CTA → live vs async picker
```

Per the file-size rule, each is ≤ 500 lines (target 200). Variant editors share an internal `<OptionsList>` subcomponent to avoid duplication.

---

## Screen 3 — Launch dialog

Triggered from the builder header. shadcn `<Dialog>`.

> **Launch this quiz**
>
> ◯ **Live**  *Everyone answers in sync. Best for study sessions.*
>     Time per question: 30s ▾    Show leaderboard: ◯
>
> ◯ **Async**  *Participants take it whenever. Closes when you say so.*
>     Open until: until I close ▾
>
> [Cancel] [**Launch**]

Mode persists on the quiz record. Once launched, status flips from `draft` → `live` (live mode) or `open` (async). Quizzes can't be edited after launch — only re-opened as a new draft via "Duplicate."

---

## Screen 4 — Participant player

URL: `?quiz=<id>&play=1`. Same page, swapped main pane.

### Async mode

```
                Quiz title
                12 questions · ~6 min · No time limit

                ┌──────────────────────────────────────┐
                │  Question 4 of 12                    │
                │                                      │
                │  What is the mitochondria?           │
                │                                      │
                │  ┌─ A ─ Powerhouse of the cell ────┐ │
                │  ┌─ B ─ Energy storage ────────────┐ │
                │  ┌─ C ─ Protein factory ───────────┐ │
                │                                      │
                │                            [Next →]  │
                └──────────────────────────────────────┘
                ───●───●───●───●───○───○───○───○───  progress
```

- Tiles: `surface-1` background, `border-border`, hover `border-glass-border-strong`, selected `border-blurple ring-1`. Letter chip in `bg-blurple/10 text-blurple`.
- One question at a time. `Next` advances; `Back` only when the prior answer hasn't been committed (per the back-button copy rule). For async we commit per-question to be re-entry safe — so no Back. Answer is editable until submit.
- Final screen: `Submit attempt`. Confirmation → results.

### Live mode

Adds three pieces over the async layout:

1. **Big circular timer** above the question card (`Timer` icon center, blurple stroke draining counter-clockwise, semantic color shift to `warning` at <5s, `destructive` at <2s).
2. **Locked tiles after answer** — selection commits immediately; can't change. Visual: `border-blurple` stays; other tiles dim.
3. **Reveal screen between questions** — fades in once timer expires *or* host advances. Shows: correct answer highlighted `success`; participant's pick highlighted `success` or `destructive`; explanation (if author wrote one); count of how many answered each option (`bg-surface-1 + width:%`).

End of live quiz → leaderboard (top 10 + "you · #N"). End of async → results summary (score, per-question correct/wrong, host's explanations).

### Host-control overlay (live mode, host only)

Floating bottom-center pill on `surface-2`:

> `Question 4 of 12` · `[ Skip → ]` · `[ Show answer ]` · `[ End quiz ]`

Lets the host advance past a stuck timer or end early. Only visible if `currentUserId === quiz.hostUserId`.

---

## Screen 5 — Results dashboard (host)

URL: `?quiz=<id>` after a quiz closes.

- Header: title, mode badge, date, attempts count, average score.
- Per-question accordion: expand to see distribution + each participant's pick (anon-OK, but v1 is named).
- Per-attempt list: participant name, score, time taken, "Grade short answers" button if any short-answer questions exist.
- `Reopen quiz` (async only) and `Duplicate as draft` actions.

Short-answer grading view: side-by-side participant response + reference answer (host's own note); host marks correct/incorrect. Recomputes score on save.

---

## Data model

### Mongoose: `Quiz`

```ts
{
  _id: ObjectId,
  channelId: string,        // uuid, opaque
  hostUserId: string,
  title: string,            // 1-120
  status: 'draft' | 'live' | 'open' | 'closed',
  mode: 'live' | 'async' | null,   // null while draft
  questions: QuizQuestion[],
  settings: {
    timePerQuestionSec: number | null,  // null = no limit
    shuffleQuestions: boolean,
    shuffleOptions: boolean,
    showLeaderboard: boolean,           // live only
  },
  liveState?: {                         // present iff status === 'live'
    currentQuestionIndex: number,
    questionStartedAt: Date,
    revealing: boolean,
  },
  createdAt: Date,
  updatedAt: Date,
  closedAt?: Date,
}

type QuizQuestion =
  | { id: string; type: 'mcq_single'; prompt: string; options: { id: string; text: string; isCorrect: boolean; explanation?: string }[] }
  | { id: string; type: 'mcq_multi';  prompt: string; options: { id: string; text: string; isCorrect: boolean; explanation?: string }[] }
  | { id: string; type: 'true_false'; prompt: string; correct: boolean; explanation?: string }
  | { id: string; type: 'short';      prompt: string; referenceAnswer?: string; explanation?: string };
```

### Mongoose: `QuizAttempt`

```ts
{
  _id: ObjectId,
  quizId: ObjectId,
  userId: string,
  startedAt: Date,
  submittedAt: Date | null,
  answers: {
    questionId: string;
    // Discriminated by referenced question's type at score time
    selectedOptionIds?: string[];   // mcq_*
    selectedBool?: boolean;         // true_false
    text?: string;                  // short
    answeredAt: Date;
    autoCorrect: boolean | null;    // null for short until host grades
    hostGraded?: boolean;           // short only
  }[],
  score: number,                    // 0..1, recomputed on grade
}
```

Indexes: `Quiz { channelId: 1, status: 1, updatedAt: -1 }`, `QuizAttempt { quizId: 1, userId: 1 } unique`.

---

## API

All under `/quiz` prefix, behind `requireAuth`, returning the `{ success, data?, error? }` envelope.

| Method · Path | Purpose |
|---|---|
| `GET    /quiz?channelId=…` | List quizzes for a channel (sidebar feed). |
| `POST   /quiz` | Create draft — body `{ channelId, title }`. |
| `GET    /quiz/:id` | Read quiz (host-edit shape includes `referenceAnswer`; participant shape strips it). |
| `PATCH  /quiz/:id` | Update title / questions / settings. Allowed only while `status === 'draft'`. |
| `DELETE /quiz/:id` | Soft-delete draft. |
| `POST   /quiz/:id/launch` | Body `{ mode: 'live' \| 'async' }`. Flips status. Returns the player payload. |
| `POST   /quiz/:id/advance` | Live-mode only; host advances to next question. |
| `POST   /quiz/:id/reveal` | Live-mode only; host forces reveal early. |
| `POST   /quiz/:id/close` | Closes a live or async quiz. |
| `POST   /quiz/:id/attempts` | Participant starts an attempt. Idempotent. |
| `PATCH  /quiz/:id/attempts/:attemptId` | Participant submits an answer (single question). |
| `POST   /quiz/:id/attempts/:attemptId/submit` | Participant finalizes attempt (async only — live auto-submits on close). |
| `GET    /quiz/:id/attempts` | Host: list attempts. |
| `PATCH  /quiz/:id/attempts/:attemptId/grade` | Host grades short-answer questions. |

Per-option `referenceAnswer` and `isCorrect` are **stripped server-side** from any payload sent to a participant before the answer is submitted, and from the live-mode payload until reveal. We never trust the client to redact this.

### Socket.IO events (live mode)

Namespace: existing `/` (no new namespace).

| Event | Direction | Payload |
|---|---|---|
| `quiz:join` | client → server | `{ quizId }` — joins room `quiz:{id}`. |
| `quiz:state` | server → client | Full live-state snapshot on join. |
| `quiz:advance` | server → room | `{ index, question, startedAt }`. |
| `quiz:reveal` | server → room | `{ index, correctAnswer, distribution }`. |
| `quiz:end` | server → room | `{ leaderboard }`. |
| `quiz:answer` | client → server | `{ quizId, questionId, answer }`. Server validates ownership + that question is live. |

Membership / authorization model: same as voice — gate on `requireAuth` for v1; flip to `Membership.findOne` once channels ships. Documented as a `TODO(channel-team):` in the service.

---

## Frontend file layout

```
frontend/src/pages/app/labs/
└── QuizLabPage.tsx              # Shell + URL-state routing

frontend/src/components/quiz/
├── QuizSidebar.tsx              # Sidebar (mirrors LabsChannelSidebar)
├── QuizBuilder.tsx
├── QuizQuestionList.tsx
├── QuizQuestionEditor.tsx
├── editors/
│   ├── McqSingleEditor.tsx
│   ├── McqMultiEditor.tsx
│   ├── TrueFalseEditor.tsx
│   └── ShortAnswerEditor.tsx
├── QuizOptionRow.tsx
├── QuizSettingsPanel.tsx
├── QuizLivePreview.tsx
├── QuizLaunchDialog.tsx
├── QuizPlayer.tsx               # Async + live router
├── QuizPlayerCard.tsx           # Single-question card
├── QuizAnswerTile.tsx           # A/B/C/D tile
├── QuizTimerRing.tsx            # Live-mode countdown
├── QuizRevealCard.tsx           # Between-question reveal
├── QuizLeaderboard.tsx          # End-of-live screen
├── QuizHostControls.tsx         # Floating host pill
├── QuizResultsDashboard.tsx     # Closed-quiz host view
└── QuizGradeShortAnswers.tsx    # Host short-answer grading

frontend/src/queries/
└── quiz.ts                      # All quiz REST + socket hooks (under qk.quiz.*)

backend/src/modules/quiz/
├── routes.ts
├── service.ts
├── socket.ts                    # registers quiz:* event handlers on the existing io
├── schemas.ts
└── models/
    ├── Quiz.ts
    └── QuizAttempt.ts
```

Per the file-size rule (`max-lines: 500`) every file lands well under. Per the modular-code rule, no `utils.ts` / `helpers.ts` — anything shared lives in a named file (`quiz-scoring.ts`, `quiz-redact.ts`).

---

## Three states per surface

Per the frontend rules, every async surface renders all three branches:

| Surface | Loading | Error | Empty |
|---|---|---|---|
| Quiz sidebar | `<QuizRowSkeleton />` ×3 | `Couldn't load quizzes. [Retry]` | `No quizzes yet. Build the first one →` (CTA opens new-draft) |
| Builder | `<BuilderSkeleton />` matching list + editor shape | `Couldn't load this quiz. [Retry]` | (Not possible — a draft always has the seed question) |
| Player | `<PlayerSkeleton />` (timer + tile placeholders) | `Couldn't join the quiz. [Retry]` | (Not possible — empty quiz can't launch) |
| Results | `<ResultsSkeleton />` | `Couldn't load results. [Retry]` | `No attempts yet. [Share link]` |

---

## Failure modes I am explicitly thinking about

Per the failure-modes rule, walking the list:

1. **Stale session in the middle of a live quiz.** Player must handle 401 from `quiz:answer` by ending the attempt and routing to sign-in. No silent retry.
2. **`isLoading` vs empty.** A channel with zero quizzes returns `[]`, not `null`. Sidebar branches on `isLoading`, not `data?.length`.
3. **Realtime socket disconnect mid-quiz.** On `quiz:state` reconnect, server replays current question + remaining time. Client renders `Reconnecting…` toast (`toast.loading`) for the gap.
4. **Optimistic answer commit.** Live-mode answer submit is fire-and-forget for UX; on `onError` the tile un-locks and a toast surfaces *"Couldn't record your answer. Try again."*
5. **Host disconnects mid-live.** Quiz auto-advances on timer regardless of host presence — server is the timer authority. Host re-joining hydrates from `quiz:state`.
6. **Re-entry mid-attempt.** Async attempts are persisted per-answer, so reload restores progress. Live attempts pick up from `quiz:state`.
7. **Two host tabs.** Host-control events are idempotent on the server (`advance` past `currentQuestionIndex` is a no-op). Both tabs reflect the same state.
8. **Clock skew.** Timer math is `serverNow - questionStartedAt`, never the client's clock. The server includes `serverNow` in every `quiz:state` and `quiz:advance` payload; the client computes a one-time `offset = serverNow - Date.now()` on join and applies it.
9. **Network offline during async submit.** `submitAttempt` mutation surfaces `toast.error` with retry button.
10. **Cache key shape.** Socket handlers write to `qk.quiz.byChannel(channelId)` and `qk.quiz.byId(id)` — same shape as the queries that read them.

---

## Tests

Per the testing rule (Vitest + Testing Library; 80% on critical path; Playwright for critical flows):

**Backend (Vitest):**
- Auth: every endpoint 401 without cookie.
- Builder: PATCH on a launched quiz → 409.
- Launch: invalid quiz (missing correct on MCQ-single) → 400 with field path.
- Redaction: participant `GET /quiz/:id` payload omits `isCorrect`, `referenceAnswer`.
- Scoring: MCQ-multi all-or-nothing scoring (matches docs/principles).
- Attempts: duplicate `POST /attempts` returns the existing attempt (idempotent).
- Live socket: `quiz:answer` after `reveal` → rejected.

**Frontend (Vitest + RTL):**
- Each editor variant: validation errors render inline; valid state enables Launch.
- Player: locked-after-answer behavior in live mode; editable in async.
- Timer ring color shifts at 5s and 2s (snapshot test on the SVG class).

**E2E (Playwright):**
- Build → launch async → second user attempts → host sees results.
- Build → launch live → second user joins → both advance through 2 questions → leaderboard.

Critical-path coverage gate: 80%.

---

## Estimated complexity

| Slice | Time |
|---|---|
| Backend module (models, routes, schemas, scoring, redaction) | 4–5h |
| Backend live-mode socket handlers + timer authority | 2–3h |
| Frontend `queries/quiz.ts` (REST + socket hooks) | 1.5h |
| Builder UI (list + editor + 4 variants + preview) | 4–5h |
| Player UI (async + live + reveal + leaderboard) | 3–4h |
| Results dashboard + short-answer grading | 2h |
| Tests (unit + 2 Playwright flows) | 3h |
| **Total** | **~20–22h** |

Suggested first PR slice (smallest shippable): backend + builder + async player only. Live mode lands as PR 2. That trims PR 1 to ~10–12h and unlocks early review.

---

## Risks

- **HIGH — Live-mode timer authority on Node.** Single-process timers are fine for one server; multi-instance deploys would need a Redis-backed timer or per-room sticky routing. v1 ships single-instance, so OK; flag for whenever scaling kicks in.
- **MEDIUM — Question-shape discriminated union.** Zod and Mongoose both need to express the discriminated `QuizQuestion`. Use a single `quizQuestionSchema` Zod source of truth, derive Mongoose typing via `z.infer`, store as a generic `Mixed` array on the document with the discriminator validated in middleware.
- **MEDIUM — Short-answer grading drift.** Host can grade after the quiz closes; results dashboard has to recompute and re-render. Score is recomputed server-side on every grade PATCH.
- **LOW — File count.** ~20 small `.tsx` files in `components/quiz/`. Within the file-organization rule (organize by feature, ≤ 200 LOC target). Keep variant editors thin; share via `<OptionsList>`.

## Open questions

- **Live-mode entry.** Do participants get a notification ("Quiz starting in #channel") or do we rely on the channel sidebar showing `Live · 12 in`? Voice presence already does the second pattern; quiz live should match. Confirm before building the launch dialog copy.
- **Short-answer grading granularity.** Just correct/incorrect, or also "partial" (0.5)? v1 default: binary. Flag if the study-app principle says otherwise.
- **Channel-team handoff timing.** Same as voice — flip the membership check from `requireAuth` to `Membership.findOne` when channels lands. No new coordination required beyond what voice already documented.
