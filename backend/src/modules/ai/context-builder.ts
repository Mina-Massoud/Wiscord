import { type Content } from '@google/genai';

import {
  CalendarEvent,
  ChannelNotes,
  Quiz,
  QuizAttempt,
  VoiceActivity,
} from '../../db/models/index.js';
import { funnyTitle } from '../../lib/funny-title.js';
import { getNotePlaintext, titleHintFromPlaintext } from './notes-plaintext.js';
import { extractUrls, fetchAll, type FetchedDoc } from './url-fetcher.js';
import { composeSystemPrompt, getVoiceBundle, type Vibe } from './voice.js';

/**
 * Voice prefill is now per-vibe. The registry in `voice.ts` builds one
 * `Content[]` array per vibe at module load (genz / chill / professional)
 * and we hand the same reference back on every request that shares a
 * vibe — keeping Gemini's implicit prefix cache hits and letting the
 * per-user voice still vary. See `getVoiceBundle` for the registry.
 */

/**
 * Lean RAG context builder for the personal AI scope.
 *
 * Pulls four signals scoped to a single user:
 *   1. The notes docs the user most recently edited (Yjs → plaintext)
 *   2. Calendar events in the ±2-week window around now
 *   3. Recent quiz attempts
 *   4. Recent voice-channel activities they hosted
 *
 * Caps are intentionally tight so the assembled context stays under
 * ~8k tokens — generous for Gemma 4 and cheap if context-caching
 * isn't available for the Gemma variants on the Gemini API.
 *
 * No embeddings, no vector search. Retrieval is filter + sort + cap.
 * When the channel / server / voice scopes land they get their own
 * builder file next to this one; the service layer picks the right
 * builder by `scope`.
 */

export const PERSONAL_LIMITS = {
  notes: 8,
  noteCharsEach: 1500,
  calendarEvents: 20,
  quizAttempts: 5,
  voiceActivities: 5,
  calendarLookbackDays: 7,
  calendarLookaheadDays: 14,
  /**
   * Minimum plaintext length (in chars, after trim) for a note to
   * count as having real content. Anything shorter is treated as a
   * scratch / test note: not included in the citable sources list
   * and not rendered into the notes data block. Stops the model
   * from citing `[note:…]` chips for one-word stubs like "Hel" or
   * "Hello!" that survived an earlier draft.
   */
  noteMinChars: 12,
} as const;

export interface PersonalContextSources {
  notes: Array<{ channelId: string; title: string; updatedAt: string }>;
  events: Array<{ id: string; title: string; startAt: string }>;
  attempts: Array<{ id: string; title: string; score: number; submittedAt: string | null }>;
  activities: Array<{ channelId: string; kind: string; title: string; startedAt: string }>;
  /** URLs the user dropped in this turn that we fetched. Surfaced
   *  so the frontend can render "📎 fetched wikipedia.org" chips
   *  alongside the existing note/event/attempt chips. `ok=false`
   *  entries mean the fetch failed — UI can show a dimmed chip
   *  with the error so the user knows we tried. */
  webSources: Array<
    | { ok: true; url: string; title: string; siteName: string | null; truncated: boolean }
    | { ok: false; url: string; error: string }
  >;
}

/**
 * Three-tier mode. Drives both prompt shape (bare vs scaffolded) and
 * history window in the service layer — see `pickMode` for the
 * routing rules and the file header in `service.ts` for how each
 * tier wires up to Gemini's `contents` array.
 *
 * - `greeting`     — true first-shot greetings ("hi", "yo", "gm").
 *                    Bare user turn, ZERO history, ZERO data blocks.
 *                    Gives the model a clean slate so a fresh "hello"
 *                    can't inherit a prior bad reply via in-context
 *                    learning.
 * - `conversation` — small talk, venting, elliptical reactions
 *                    ("whaaaat", "not me", "i guess"), banter. Bare
 *                    user turn matching the shape of every prior
 *                    user turn in history, plus a SMALL window of
 *                    history (6 turns) so the model can read the
 *                    thread. No data blocks — the model can't cite
 *                    what isn't in the prompt.
 * - `grounded`     — explicit data/scheduling intent ("what's in my
 *                    notes", "schedule X tomorrow"). Full structured
 *                    user-turn scaffold (NOW + data blocks + tail)
 *                    plus the longer 11-turn history.
 */
export type AiMode = 'greeting' | 'conversation' | 'grounded';

export interface PersonalContext {
  /** Stable preamble — model + scope rules only. Few-shot anchors
   *  no longer live here; they're prepended to `contents` as
   *  prefill turn pairs via `prefillContents` below. */
  system: string;
  /** Few-shot examples as ready-to-prepend Gemini Content entries.
   *  The service layer pushes these onto the front of the
   *  `contents` array before real conversation history. Identical
   *  reference across requests so the API's implicit prefix cache
   *  can amortize the cost. */
  prefillContents: Content[];
  /** The current user-turn payload to push as the final entry in
   *  Gemini's `contents` array. Bare text for `greeting` and
   *  `conversation`; structured `=== NOW === / === MY NOTES === / …`
   *  scaffold for `grounded`. The shape parity between bare-text
   *  current turns and bare-text history is what lets the model
   *  follow conversational thread on short elliptical replies. */
  user: string;
  /** Ids surfaced to the UI for citation chips. Empty for `greeting`
   *  and `conversation` — those modes ship no data blocks, so the
   *  model has no ids to cite. */
  sources: PersonalContextSources;
  /** Routing tier — service layer uses this to size the history
   *  window and decide whether to send `user` as bare text or as
   *  a structured scaffold. */
  mode: AiMode;
}

/**
 * Strict greeting regex — only true conversation-openers, capped at
 * ≤20 chars for the `greeting` tier. Anything longer or anything
 * that doesn't match here (including small talk like "what's up",
 * vent triggers like "i'm tired", elliptical reactions like
 * "whaaaat") drops into the `conversation` tier where it gets
 * history but no data blocks.
 *
 * Tightening this from the old broad chit-chat list is intentional:
 * the old broad match was eating multi-turn vent threads — short
 * follow-ups like "whaaaat" and "not me" were getting the no-history
 * treatment and the model lost the thread (see the engagement-vent
 * regression that prompted this rewrite).
 */
const GREETING_RE =
  /^(hi+|hey+|yo+|sup|wassup|wsg|wagwan|hello+|hola|howdy|heya|hiya|gm|gn|good\s+(morning|evening|night|afternoon)|mornin|evening|night)[\s!.?,]*$/i;

/**
 * Data / scheduling intent. Hits route to `grounded` mode regardless
 * of length — they need the data blocks and the structured scaffold.
 *
 * Bias: better to over-route to grounded (extra context, harmless)
 * than to under-route (model would have to invent answers).
 */
const DATA_KEYWORDS_RE =
  /\b(notes?|note|calendar|event|events|schedule|scheduled|quiz|quizzes|attempt|attempts|score|activit(y|ies)|watch\s+party|whiteboard|pomodoro|tomorrow|today|tonight|next\s+(week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|remind|reminder|add|create|schedule|move|cancel|delete|when\s+(is|do|did)|what\s+(do\s+i|did\s+i|am\s+i|are\s+my|is\s+on|are\s+on)|my\s+(notes?|calendar|schedule|quiz|events?|activit)|study|exam|deck|flashcards?|homework|deadline|due)\b/i;

function pickMode(question: string): AiMode {
  const trimmed = question.trim();
  if (trimmed.length === 0) return 'greeting';
  // A URL in the question always means grounded — we're about to
  // fetch and surface a WEB SOURCES block, which only the grounded
  // template renders. Wins over greeting / conversation shape so a
  // bare "https://…" or a bare "example.com" doesn't get treated as
  // small talk. Using extractUrls (vs a regex) keeps the bare-domain
  // logic in one place — TLD whitelist lives in url-fetcher.
  if (extractUrls(trimmed).length > 0) return 'grounded';
  // Data intent wins over greeting shape — "remind me to say hi to
  // mom" mentions hi but is clearly a scheduling ask.
  if (DATA_KEYWORDS_RE.test(trimmed)) return 'grounded';
  if (trimmed.length <= 20 && GREETING_RE.test(trimmed)) return 'greeting';
  return 'conversation';
}

/**
 * Build a personal-scope context for `userId`.
 *
 * Pure with respect to the caller — only reads from Mongo. The
 * service layer pairs the returned strings with the chosen provider.
 */
export async function buildPersonalContext(args: {
  userId: string;
  question: string;
  /** IANA timezone (e.g. 'Africa/Cairo'). When set, the NOW
   *  anchor in the user prompt is rendered in the caller's local
   *  clock + the model is instructed to emit offset-aware ISO
   *  timestamps. Defaults to UTC when absent. */
  timezone?: string;
  /** Caller's subscription tier. Drives the URL-summarization
   *  path: free users get a shorter content excerpt and the
   *  short-note nudge; pro users get the full content + long-note
   *  instruction. Defaults to `free` so unaware callers (legacy
   *  tests) take the conservative path. */
  tier?: 'free' | 'pro';
  /** Caller's voice vibe. Picks which voice rules block sits above
   *  the scope rules in the system prompt AND which few-shot
   *  prefill array rides at the head of `contents`. Defaults to
   *  `genz` (the historic Wiscord default) when the caller hasn't
   *  threaded it through yet, so legacy tests keep passing. */
  vibe?: Vibe;
}): Promise<PersonalContext> {
  const { userId, question, timezone } = args;
  const tier = args.tier ?? 'free';
  const vibe: Vibe = args.vibe ?? 'genz';
  const voiceBundle = getVoiceBundle(vibe);
  const systemPrompt = composeSystemPrompt(PERSONAL_SCOPE_RULES, vibe);

  // Prior turns no longer ride in the user prompt — they go in
  // Gemini's `contents` array as proper role-tagged messages with
  // functionCall / functionResponse parts (assembled by the service
  // layer). Putting them here as prose broke tool-use state on
  // follow-up turns.

  // Greeting + conversation tiers ship a BARE current user turn,
  // matching the shape of every prior user turn in history. The
  // structured `=== NOW === / === MY NOTES === / …` scaffold only
  // appears in the `grounded` branch below where it's earning its
  // keep (data to cite, NOW anchor for time math).
  //
  // Why bare matters: the model imitates the structural shape of
  // the most recent user turn it sees. If history is
  // `user: "my gf left me" / model: "oof"` and the current turn
  // is a heavily-templated RAG scaffold, Gemma reads the current
  // turn as a fresh isolated query and loses the vent thread on
  // elliptical follow-ups like "whaaaat". Shape parity fixes it.
  //
  // No data blocks for these tiers means the model has no source
  // ids in the prompt, so it can't emit `[note:xxx]` chips for
  // an unrelated chat. The frontend filters citations against
  // `sources` (empty here), so any stray bracket renders as raw
  // text rather than a clickable chip.
  const mode = pickMode(question);
  if (mode === 'greeting' || mode === 'conversation') {
    return {
      system: systemPrompt,
      prefillContents: voiceBundle.prefillContents,
      user: question.trim(),
      sources: { notes: [], events: [], attempts: [], activities: [], webSources: [] },
      mode,
    };
  }

  const now = Date.now();
  const lookback = new Date(now - PERSONAL_LIMITS.calendarLookbackDays * 24 * 60 * 60 * 1000);
  const lookahead = new Date(now + PERSONAL_LIMITS.calendarLookaheadDays * 24 * 60 * 60 * 1000);

  // URL fetching runs in parallel with the DB lookups — the slowest
  // single call wins, not the sum. `fetchAll` handles its own errors
  // (returns FetchedDoc[] with `ok:false` entries on failure) so we
  // never need to wrap this in a try/catch.
  const urlsInQuestion = extractUrls(question);

  const [notesRows, eventRows, attemptRows, activityRows, fetchedDocs] = await Promise.all([
    ChannelNotes.find({ updatedBy: userId })
      .sort({ updatedAt: -1 })
      .limit(PERSONAL_LIMITS.notes),
    CalendarEvent.find({
      userId,
      startAt: { $gte: lookback, $lte: lookahead },
    })
      .sort({ startAt: 1 })
      .limit(PERSONAL_LIMITS.calendarEvents),
    QuizAttempt.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(PERSONAL_LIMITS.quizAttempts),
    VoiceActivity.find({ hostUserId: userId })
      .sort({ startedAt: -1 })
      .limit(PERSONAL_LIMITS.voiceActivities),
    fetchAll(urlsInQuestion),
  ]);

  // Decode each Yjs note doc to plaintext + derive a chip title
  // from the same decode (calling getNoteTitleHint separately would
  // re-load the row from Mongo and re-decode the CRDT — 2x work
  // per note). The title is the first non-empty line truncated to
  // 40 chars, falling back to a deterministic funny title so the
  // chip never shows a raw channel id.
  //
  // Notes whose plaintext is below `noteMinChars` are dropped
  // entirely — they're almost always scratch / test docs (single
  // words like "Hel", "Hello!") and surfacing them lets the model
  // produce confidently-cited junk on otherwise irrelevant chats.
  const decodedNotes = await Promise.all(
    notesRows.map(async (row) => {
      const text = await getNotePlaintext(row.channelId);
      return {
        channelId: row.channelId,
        updatedAt: row.updatedAt?.toISOString() ?? new Date(0).toISOString(),
        text,
      };
    }),
  );
  const notesEntries = decodedNotes
    .filter((n) => n.text.trim().length >= PERSONAL_LIMITS.noteMinChars)
    .map((n) => ({
      channelId: n.channelId,
      title: titleHintFromPlaintext(n.text) ?? funnyTitle(n.channelId),
      updatedAt: n.updatedAt,
      text: n.text.slice(0, PERSONAL_LIMITS.noteCharsEach),
    }));

  // Join quiz attempts with their quiz title — the attempt row
  // itself only carries a quizId, so we batch-resolve names.
  const quizIds = Array.from(new Set(attemptRows.map((a) => String(a.quizId))));
  const quizDocs = quizIds.length === 0
    ? []
    : await Quiz.find({ _id: { $in: quizIds } }, { title: 1 }).lean();
  const quizTitleById = new Map<string, string>(
    quizDocs.map((q) => [String(q._id), q.title ?? '']),
  );

  const sources: PersonalContextSources = {
    notes: notesEntries.map((n) => ({
      channelId: n.channelId,
      title: n.title,
      updatedAt: n.updatedAt,
    })),
    events: eventRows.map((e) => ({
      id: String(e._id),
      title: e.title,
      startAt: e.startAt.toISOString(),
    })),
    attempts: attemptRows.map((a) => ({
      id: String(a._id),
      title: quizTitleById.get(String(a.quizId)) || funnyTitle(String(a._id)),
      score: a.score,
      submittedAt: a.submittedAt?.toISOString() ?? null,
    })),
    activities: activityRows.map((v) => ({
      channelId: v.channelId,
      kind: v.kind,
      title: activityLabel(v.kind),
      startedAt: v.startedAt.toISOString(),
    })),
    webSources: fetchedDocs.map((d) =>
      d.ok
        ? { ok: true as const, url: d.url, title: d.title, siteName: d.siteName, truncated: d.truncated }
        : { ok: false as const, url: d.url, error: d.error },
    ),
  };

  // Tier-aware truncation. Free users get a short excerpt (~1k
   // tokens) which is enough for a 200–400 word genz summary; Pro
   // users get the full fetched content (~3k tokens) which the
   // long-note prompt path needs to produce real depth. The fetcher
   // already capped at maxContentChars; this slice is a further trim
   // for the free tier so cost stays predictable for non-paying URL
   // summarization (which they get up to 3/day).
  const FREE_TIER_WEB_CHARS = 4_000;
  const tieredDocs =
    tier === 'pro'
      ? fetchedDocs
      : fetchedDocs.map((d) =>
          d.ok && d.content.length > FREE_TIER_WEB_CHARS
            ? { ...d, content: d.content.slice(0, FREE_TIER_WEB_CHARS), truncated: true }
            : d,
        );
  const webSourcesBlock = renderWebSourcesBlock(tieredDocs);

  const notesBlock =
    notesEntries.length === 0
      ? '(no notes yet)'
      : notesEntries
          .map((n) => `[note:${n.channelId}] (updated ${n.updatedAt})\n${n.text}`)
          .join('\n\n---\n\n');

  const eventsBlock =
    eventRows.length === 0
      ? '(no calendar events in window)'
      : eventRows
          .map(
            (e) =>
              `[event:${String(e._id)}] ${e.title} · ${e.startAt.toISOString()}${
                e.description ? `\n  ${e.description.slice(0, 200)}` : ''
              }`,
          )
          .join('\n');

  const attemptsBlock =
    attemptRows.length === 0
      ? '(no recent quiz attempts)'
      : attemptRows
          .map(
            (a) =>
              `[attempt:${String(a._id)}] score=${a.score.toFixed(2)} submitted=${
                a.submittedAt?.toISOString() ?? 'in_progress'
              }`,
          )
          .join('\n');

  const activitiesBlock =
    activityRows.length === 0
      ? '(no recent voice activities)'
      : activityRows
          .map(
            (v) =>
              `[activity:${v.channelId}] kind=${v.kind} startedAt=${v.startedAt.toISOString()}`,
          )
          .join('\n');

  // Anchor for relative-time phrases ("tomorrow at 9am", "tonight",
  // "next monday"). Without this the model invents a reference
  // date from its training-data prior — events land on random
  // days. With it, every relative time resolves correctly.
  //
  // Critically: the user thinks in LOCAL time. If the caller is
  // in UTC+3 and says "9 AM", they mean 09:00 local — emitting
  // `T09:00:00Z` lands the event at 12:00 PM local. We surface
  // the user's IANA timezone AND tell the model to emit
  // offset-aware ISO (`T09:00:00+03:00`) so local hour stays
  // local hour.
  const nowBlock = formatNowBlock(timezone);

  return {
    system: systemPrompt,
    user: assembleUserPrompt({
      nowBlock,
      notesBlock,
      eventsBlock,
      attemptsBlock,
      activitiesBlock,
      webSourcesBlock,
      hasWebSources: fetchedDocs.length > 0,
      tier,
      question,
    }),
    sources,
    mode: 'grounded',
    prefillContents: voiceBundle.prefillContents,
  };
}

/**
 * Personal-scope rules. Two modes:
 *   - chit-chat (default) — greetings, small talk, anything not
 *     pointing at the user's data. Context below exists but the
 *     model MUST NOT surface it unprompted.
 *   - grounded — when the user actually asks about their notes,
 *     calendar, quizzes, or activities, OR asks for a calendar
 *     tool action. Then pull from the context block and cite.
 *
 * The voice / register / length rules live in `voice.ts` and are
 * layered on top by `composeSystemPrompt`.
 */
const PERSONAL_SCOPE_RULES = `SCOPE — personal mate with access to the user's stuff
You're talking to the signed-in user. You have access to their notes, calendar events, recent quiz attempts, and recent voice-channel activities in the context block below. You do NOT have to use any of it. Use it when the question is actually about their data; otherwise just chat.

Pick the mode from the question:

CHIT-CHAT MODE (default) — when the question is a greeting, small talk, a vibe check, venting, a meta question about you, or anything that doesn't reference their notes / schedule / quizzes / activities:
- JUST TALK BACK. Be a friend.
- Do NOT list their notes, schedule, or any data.
- Do NOT include any [note:…] / [event:…] / [attempt:…] / [activity:…] brackets. Zero citations.
- Do NOT mention that you have access to their stuff unless they ask.

GROUNDED MODE — when the question is actually about their notes, calendar, quizzes, or activities, OR asks you to do something with them (add/move/delete a calendar event, generate an exam, save a note), OR the user dropped a URL for you to summarize/explain:
- Pull the answer from the context block below.
- Cite inline with the bracket forms:
  - [note:<channelId>]     — for content from MY NOTES
  - [event:<id>]           — for items from MY CALENDAR
  - [attempt:<id>]         — for items from MY RECENT QUIZ ATTEMPTS
  - [activity:<channelId>] — for items from MY RECENT VOICE ACTIVITIES
  - [quiz:<id>]            — ONLY after the user confirms a generateExam tool call; echo the returned quizId so the UI renders the chip linking to the new draft workshop
  - [web:<n>]              — for facts pulled from the WEB SOURCES block (use the n we assigned, e.g. [web:1])
  Use the bracket form exactly. The UI renders them as clickable chips.
- If the answer genuinely isn't in the context, say so in one short sentence and stop. Don't invent facts, don't guess, don't pull from general knowledge.

URL SUMMARIZATION — when the user shared a link AND asks you to explain / summarize / break it down / make a note about it (the WEB SOURCES block below is populated):
- Call createNote with a LONG markdown body grounded in the fetched content (1500–3000 words, multiple ## sections, real depth). The user wants to scroll through real material, not skim three paragraphs.
- The note voice stays genz — same dry confident register as the rest of your replies. Long ≠ formal.
- Your chat reply itself stays short (1–2 sentences acknowledging the note dropped, e.g. "saved it 🙏"). The depth lives in the note doc, not in the chat bubble.
- Cite [web:n] in the note body wherever you're pulling a specific fact from the source so the user can trace claims back to the page.

GENERATE-EXAM FLOW — when the user asks to make/build a quiz, exam, test, or practice questions:
- This is the generateExam tool. It REQUIRES channelId. Never invent one.
- If the user named a channel (UUID, slug, or a [note:<channelId>] / [activity:<channelId>] chip in this conversation), use that channelId.
- If they didn't name one, do NOT call the tool — reply in one short sentence asking which channel and stop. e.g. "which channel should i drop it in?"
- After they confirm and you see the tool result, send ONE short text reply with a [quiz:<id>] chip — like "done, here: [quiz:abc123def]". Don't list the questions in chat; the chip opens the workshop.

Default to chit-chat mode. Only switch to grounded mode when the question actually warrants it.`;

// Note: the per-request system prompt is composed inside
// `buildPersonalContext` so each call picks up the caller's `vibe`.
// We deliberately do NOT precompute a single module-level prompt
// here — that would lock the voice to a single vibe across users.

interface UserPromptArgs {
  nowBlock: string;
  notesBlock: string;
  eventsBlock: string;
  attemptsBlock: string;
  activitiesBlock: string;
  /** Pre-rendered WEB SOURCES block (one entry per URL we tried to
   *  fetch this turn). Empty string when the user dropped no URLs. */
  webSourcesBlock: string;
  /** True when we fetched at least one URL — drives the
   *  long-note-when-link-was-shared instruction in the tail. */
  hasWebSources: boolean;
  /** Caller's tier. Free gets a short-note nudge (200–400 words);
   *  pro gets the deep long-note nudge (1500–3000 words). */
  tier: 'free' | 'pro';
  question: string;
}

/**
 * Per-surface keyword detection. The hit with the most distinct
 * matches becomes the "primary" surface for this turn; ties or
 * zero-hit questions fall back to the default ordering.
 *
 * Used by `assembleUserPrompt` to put the most-relevant data block
 * in the final slot before QUESTION — the end of the user prompt
 * is the attention peak in the well-known Lost-in-the-Middle
 * pattern (arxiv:2307.03172). Middle blocks routinely get ignored
 * even when the answer is sitting in plain sight.
 */
const SURFACE_KEYWORDS = {
  notes: /\b(note|notes|notebook|tldr|summary|summarize|wrote|writing|draft|outline|deck|highlight)\b/i,
  calendar: /\b(calendar|event|events|schedule|scheduled|tomorrow|today|tonight|yesterday|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|o'clock|deadline|due|appointment|remind|reminder|when\s+is|when\s+do)\b/i,
  quizzes: /\b(quiz|quizzes|attempt|attempts|score|scored|exam|test|grade|grades|practice|recall|weakest|strongest)\b/i,
  activities: /\b(voice|call|hopped\s+on|hopped\s+in|watch\s+party|whiteboard|pomodoro|focus\s+session|activity|activities|session)\b/i,
} as const;

type Surface = keyof typeof SURFACE_KEYWORDS;

function pickPrimarySurface(question: string): Surface | null {
  let best: Surface | null = null;
  let bestHits = 0;
  for (const surface of Object.keys(SURFACE_KEYWORDS) as Surface[]) {
    const re = new RegExp(SURFACE_KEYWORDS[surface].source, 'gi');
    const hits = (question.match(re) ?? []).length;
    if (hits > bestHits) {
      best = surface;
      bestHits = hits;
    } else if (hits === bestHits && hits > 0 && best !== null) {
      // Tie → ambiguous, fall back to default ordering rather than
      // arbitrarily picking one surface.
      best = null;
    }
  }
  return best;
}

function assembleUserPrompt(args: UserPromptArgs): string {
  // Tail reminder: end-of-prompt instructions stick harder than
  // system-prompt rules, and they override the model's tendency
  // to imitate its own prior turns in the conversation history.
  // Without this, a single bad past reply (e.g. dumping notes on
  // a greeting) gets parroted on every subsequent greeting via
  // in-context learning, regardless of what the system prompt says.
  //
  // The web-sources branch adds an extra rule: when the user shared
  // a link and we successfully fetched it, the right move is almost
  // always `createNote` with a LONG body (1500–3000 words) grounded
  // in the fetched content. Without this nudge the model defaults to
  // its 150–600 word target and the resulting note reads thin —
  // exactly the regression that prompted this whole feature.
  // Free tier gets a short-note nudge: 200–400 words, conversational
  // depth, not a treatise. The fetched content excerpt is already
  // trimmed to ~4000 chars for free users so the model has less to
  // summarize anyway. Pro tier unlocks the long-note path with the
  // full content excerpt + the 1500–3000 word instruction.
  const webNudge = args.hasWebSources
    ? args.tier === 'pro'
      ? '\n- If the user shared a URL and asked you to explain / summarize / break it down / make a note about it → call createNote with a LONG markdown body (1500–3000 words) grounded in the WEB SOURCES block above. Go deep: multiple ## sections, real structure, the user can scroll. Voice stays genz — long ≠ formal.'
      : '\n- If the user shared a URL and asked you to explain / summarize / break it down / make a note about it → call createNote with a SHORT markdown body (200–400 words) grounded in the WEB SOURCES block above. One ## section is fine, two max. This is the free-tier note — tight, useful, no padding. Pro users get the long version; do not pretend to write more than this here.'
    : '';
  const tail = `=== HOW TO ANSWER ===\nRead the QUESTION above and pick the mode:\n- If it's a greeting, small talk, or anything NOT about the user's notes / calendar / quizzes / activities → chit-chat mode. Reply in 1–2 short sentences. ZERO citations. ZERO mention of their data. Just be a friend.\n- If it's actually about their data, or asks for a calendar action → grounded mode. Pull from the blocks above and cite with the bracket forms.${webNudge}\nDo not imitate your prior assistant turns if they violate these rules. The rules win.`;

  // Lost-in-the-Middle reordering: pick the dominant data surface
  // from the question, then move that block to the end of the data
  // section (immediately before QUESTION). Other blocks keep their
  // relative order so a quiz question doesn't randomly relocate the
  // notes block above NOW.
  const blocks: Array<{ surface: Surface; header: string; body: string }> = [
    { surface: 'notes', header: '=== MY NOTES ===', body: args.notesBlock },
    { surface: 'calendar', header: '=== MY CALENDAR (±2 weeks) ===', body: args.eventsBlock },
    { surface: 'quizzes', header: '=== MY RECENT QUIZ ATTEMPTS ===', body: args.attemptsBlock },
    { surface: 'activities', header: '=== MY RECENT VOICE ACTIVITIES ===', body: args.activitiesBlock },
  ];
  const primary = pickPrimarySurface(args.question);
  const orderedBlocks =
    primary === null
      ? blocks
      : [...blocks.filter((b) => b.surface !== primary), ...blocks.filter((b) => b.surface === primary)];

  const dataSection = orderedBlocks.map((b) => `${b.header}\n${b.body}`).join('\n\n');
  // Web sources block lives AFTER the user's own data — when the
  // user dropped a link, that link is almost always the primary
  // surface for this turn, so it goes right before QUESTION to land
  // in the attention peak (same Lost-in-the-Middle logic).
  const webSection = args.hasWebSources ? `\n\n${args.webSourcesBlock}` : '';
  return `=== NOW ===\n${args.nowBlock}\n\n${dataSection}${webSection}\n\n=== QUESTION ===\n${args.question}\n\n${tail}`;
}

/**
 * Render the WEB SOURCES data block from a list of `FetchedDoc`s.
 * Successful fetches show title + byline + content; failed fetches
 * show just the URL + error so the model can acknowledge that we
 * tried but couldn't read it.
 *
 * Returns the empty string when `docs` is empty — caller checks
 * `hasWebSources` before splicing it into the prompt.
 */
function renderWebSourcesBlock(docs: FetchedDoc[]): string {
  if (docs.length === 0) return '';
  const lines: string[] = ['=== WEB SOURCES (fetched for this turn) ==='];
  docs.forEach((doc, i) => {
    const idx = i + 1;
    if (!doc.ok) {
      lines.push(
        `\n[web:${idx}] ${doc.url}\n  fetch failed: ${doc.error}\n  Acknowledge to the user that this link couldn't be read; don't invent content.`,
      );
      return;
    }
    const header = `[web:${idx}] ${doc.url}\nTitle: ${doc.title}${doc.siteName ? `\nSite: ${doc.siteName}` : ''}${doc.byline ? `\nByline: ${doc.byline}` : ''}${doc.truncated ? '\nNote: content was truncated to fit the context budget.' : ''}`;
    lines.push(`\n${header}\n---\n${doc.content}\n---`);
  });
  return lines.join('\n');
}

/**
 * Render the NOW anchor block. When `timezone` is a valid IANA
 * zone, the model sees the current moment in the user's local
 * clock plus an explicit instruction to emit offset-aware ISO
 * timestamps. When absent or invalid, falls back to UTC.
 *
 * Why offset-aware: storing `2026-05-18T09:00:00+03:00` parses
 * to the right UTC instant, but the *user* and the *calendar
 * view* both reason in local time — keeping the local hour in
 * the timestamp itself preserves intent across every boundary.
 */
function formatNowBlock(timezone: string | undefined): string {
  const now = new Date();
  if (timezone && isValidTimezone(timezone)) {
    const localIso = formatLocalIso(now, timezone);
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
    return `${localIso} (${dayName}, ${timezone}). Use this as the anchor for any relative time the user mentions ("tomorrow" = next day in their local clock, "tonight" = this evening local, "next monday" = the upcoming Monday). The user's timezone is ${timezone}. When calling calendar tools, ALWAYS emit offset-aware ISO 8601 strings in the user's local zone — e.g. "9 AM tomorrow" becomes "${plusOneDayLocalIso(now, timezone, 9, 0)}". Never emit a "Z" UTC string and never emit a time without an offset.`;
  }
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return `${now.toISOString()} (${dayName}, UTC). Use this as the anchor for any relative time the user mentions. Emit ISO 8601 UTC datetimes when calling calendar tools.`;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Render a Date as ISO 8601 in the given timezone, including the
 * numeric offset. `Intl.DateTimeFormat` doesn't give us this
 * directly — we walk its parts and rebuild the string.
 */
function formatLocalIso(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  let year = Number(get('year'));
  let month = Number(get('month'));
  let day = Number(get('day'));
  let hour = Number(get('hour'));
  // Intl can yield hour=24 for midnight in some locales (it's the
  // end-of-day form for the previous calendar day). Roll it over to
  // 00:00 of the next day so the rendered ISO matches what Date()
  // would parse back to.
  if (hour === 24) {
    hour = 0;
    const rolled = new Date(Date.UTC(year, month - 1, day) + 24 * 60 * 60 * 1000);
    year = rolled.getUTCFullYear();
    month = rolled.getUTCMonth() + 1;
    day = rolled.getUTCDate();
  }
  const minute = get('minute');
  const second = get('second');
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}:${second}${tzOffsetString(date, timezone)}`;
}

/** `+03:00` style offset string for a date in the given zone. */
function tzOffsetString(date: Date, timezone: string): string {
  // Derive offset by comparing the formatted local time to UTC.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  let year = Number(get('year'));
  let month = Number(get('month'));
  let day = Number(get('day'));
  let hour = Number(get('hour'));
  // Intl can yield hour=24 (end-of-day for the previous calendar
  // day) — roll the date forward, otherwise asUTC lands 24h before
  // the real local instant and the resulting offset is wildly wrong
  // (e.g. -21:00 instead of +03:00 in zones that hit this case).
  if (hour === 24) {
    hour = 0;
    const rolled = new Date(Date.UTC(year, month - 1, day) + 24 * 60 * 60 * 1000);
    year = rolled.getUTCFullYear();
    month = rolled.getUTCMonth() + 1;
    day = rolled.getUTCDate();
  }
  const asUTC = Date.UTC(year, month - 1, day, hour, Number(get('minute')), Number(get('second')));
  const offsetMin = Math.round((asUTC - date.getTime()) / 60_000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Example string for the prompt: tomorrow at HH:MM local. Used
 * inline so the model has a concrete instance of the format it
 * should emit.
 */
function plusOneDayLocalIso(now: Date, timezone: string, hour: number, minute: number): string {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // Get the date parts for tomorrow in the target zone, then
  // splice in the requested hour/minute.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(tomorrow);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${date}T${hh}:${mm}:00${tzOffsetString(tomorrow, timezone)}`;
}

/**
 * Human label for a voice-activity chip. The activity model only
 * carries a `kind` discriminator — no human title — so we map
 * each kind to a short readable phrase.
 */
function activityLabel(kind: string): string {
  switch (kind) {
    case 'youtube':
      return 'watch party';
    case 'screen-share':
      return 'screen share';
    case 'notes':
      return 'notes session';
    case 'whiteboard':
      return 'whiteboard';
    case 'quiz':
      return 'quiz';
    case 'pomodoro':
      return 'pomodoro';
    default:
      return kind;
  }
}
