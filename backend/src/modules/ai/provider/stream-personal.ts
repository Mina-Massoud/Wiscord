import { type Content, type GoogleGenAI, type Tool, Type } from '@google/genai';

import { env } from '../../../lib/env.js';
import { logger } from '../../../lib/logger.js';

/**
 * Tool function declarations passed to Gemini. Four tools for v1
 * across calendar + notes surfaces. Schemas mirror `tool-runner.ts`
 * so the model never produces args we can't validate.
 */
const AI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'createCalendarEvent',
        description:
          "Add a new event to the user's personal calendar. ALWAYS call this tool whenever the user expresses scheduling intent — explicit ('schedule X at Y', 'add Z to my calendar', 'remind me', 'block out time') OR implicit follow-ups that reference a prior scheduling action ('another one at 2pm', 'same thing tomorrow', 'one more'). Never respond with text alone for scheduling requests. Runs immediately — no confirmation.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Short human title (≤200 chars).' },
            startAt: {
              type: Type.STRING,
              description:
                "ISO 8601 datetime with a literal 'T' separator and a timezone designator. Use the user's local offset from the NOW anchor in the user prompt (e.g. '2026-05-17T18:00:00+03:00'); fall back to '...Z' only when the user prompt explicitly says UTC. NEVER emit a space-separated form ('2026-05-17 18:00') or a naive datetime without an offset — both are rejected server-side.",
            },
            endAt: {
              type: Type.STRING,
              description:
                "ISO 8601 datetime with literal 'T' separator and offset, matching the same format and timezone as startAt. Must be strictly after startAt.",
            },
            description: { type: Type.STRING, description: 'Optional longer notes.' },
            allDay: { type: Type.BOOLEAN, description: 'True if this is an all-day event.' },
          },
          required: ['title', 'startAt', 'endAt'],
        },
      },
      {
        name: 'updateCalendarEvent',
        description:
          "Modify an existing calendar event. Requires the user's explicit confirmation before running — you'll only see the result after they click Confirm. The `eventId` MUST come from an [event:<id>] citation chip the user can see in the current conversation context — never invent one.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            eventId: {
              type: Type.STRING,
              description:
                "Existing event id, taken verbatim from an [event:<id>] citation in the prompt's MY CALENDAR block.",
            },
            title: { type: Type.STRING },
            startAt: {
              type: Type.STRING,
              description:
                "ISO 8601 datetime with literal 'T' separator and offset (see createCalendarEvent for the exact format).",
            },
            endAt: {
              type: Type.STRING,
              description:
                "ISO 8601 datetime with literal 'T' separator and offset (see createCalendarEvent for the exact format).",
            },
            description: { type: Type.STRING },
            allDay: { type: Type.BOOLEAN },
          },
          required: ['eventId'],
        },
      },
      {
        name: 'deleteCalendarEvent',
        description:
          "Delete a calendar event. Requires the user's explicit confirmation before running. The `eventId` MUST come from an [event:<id>] citation chip the user can see in the current conversation context — never invent one.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            eventId: {
              type: Type.STRING,
              description:
                "Existing event id, taken verbatim from an [event:<id>] citation in the prompt's MY CALENDAR block.",
            },
          },
          required: ['eventId'],
        },
      },
      {
        name: 'createNote',
        description:
          "Save a new note doc to the user's notes lab. Call this whenever the user asks you to write a plan, summary, study guide, checklist, breakdown, or any long-form structured content they want to keep. Creates a fresh notes doc and surfaces it as a clickable pill in the chat; the user can open it in the editor or delete it from /app/labs/notes. Runs immediately, no confirmation. Write `markdown` in your normal genz voice.\n\nSTRUCTURE — Notion-style. Get these right or the note reads as a wall of text.\n\nHeading levels — ONLY `#`, `##`, `###`. NEVER `####`, `#####`, `######` — those have no styling and render as plain bold text indistinguishable from a body paragraph (the renderer coerces them to `###` anyway, so use `###` directly). Hierarchy is: `#` = document title (use ONCE, at the top), `##` = major section, `###` = subsection.\n\nLists are the default for itemized content. The MOMENT you find yourself writing two-plus paragraphs that each start with `Term:` / `Name:` / `Date:` / `Period:` followed by an explanation, STOP — that is a bullet list, not paragraphs. Write it as `- Term: explanation` (one bullet per line). Same for steps (`1.` ordered) and short examples. A list of 4 items as paragraphs reads as a wall; the same 4 items as bullets read as a scannable list. THIS IS THE #1 STRUCTURE MISTAKE — do not make it.\n\nBLANK LINE between every block — heading, paragraph, list, blockquote, code. Markdown collapses adjacent lines into the same paragraph; a blank line is what creates a new block.\n\nFor multi-line explanations under a heading, ONE paragraph of prose THEN a bullet list of named items is the canonical Notion shape. Avoid heading → heading → heading with no body — sections need at least a sentence of context before the list.\n\nCode in fenced ``` blocks. Quotes in `> blockquote`. DO NOT use `**bold**`, `*italic*`, `~~strike~~`, or `[links](url)` — inline marks are stripped at parse time, so the asterisks vanish and the text reads plain anyway. Lean on headings + list nesting + a single well-placed blockquote for visual hierarchy instead.\n\nTypical length 150–600 words; longer only if the user explicitly asks for depth. Don't pad — a tight, well-structured plan beats a wordy one.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description:
                "Short human title for the note (≤200 chars). Becomes the chip label in the chat AND the H1 in the saved doc — if your `markdown` already starts with `# Something`, the runtime won't double up.",
            },
            markdown: {
              type: Type.STRING,
              description:
                "The note body in markdown. Use headings, bullets, ordered lists, blockquotes, and code blocks — no inline marks. ≤20000 chars.",
            },
          },
          required: ['title', 'markdown'],
        },
      },
      {
        name: 'generateExam',
        description:
          "Generate a full study exam/quiz and save it as a DRAFT to a channel's quiz workshop. Call this whenever the user asks you to make/build/generate an exam, quiz, test, practice, or set of practice questions. REQUIRES `channelId` — if the user didn't say which channel to put it in, DO NOT GUESS, reply in one short sentence asking which channel and stop. Requires the user's explicit confirmation before running because it writes a potentially-large draft to their workspace — you'll only see the result after they click Confirm. After confirmation, the runtime returns a `quizId` and the user can open the editable workshop via the [quiz:<id>] chip you echo. The quiz is created as DRAFT — never auto-launched, the user reviews and launches manually. Pick a reasonable `questionCount` from the user's prompt (default 10 if they didn't say; max 100). Pick `types` based on the user's intent (default mcq_single + true_false). If the user pasted source material in the conversation, copy it verbatim into the `source` field — do not paraphrase it.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            channelId: {
              type: Type.STRING,
              description:
                'UUID of the channel that should own the new draft quiz. MUST be a real channelId the user has referenced in this conversation. Never invent one.',
            },
            title: {
              type: Type.STRING,
              description:
                'Short human title for the quiz (≤120 chars), e.g. "Krebs cycle review". Becomes the chip label.',
            },
            topic: {
              type: Type.STRING,
              description:
                'The subject matter the AI generator should write questions about, ≤500 chars. Be specific — "WW2 Pacific theatre 1942" beats "history".',
            },
            questionCount: {
              type: Type.INTEGER,
              description:
                'Number of questions to generate, 1–100. Default 10 if the user didn\'t specify.',
            },
            types: {
              type: Type.ARRAY,
              description:
                'Which question types to mix in. Default ["mcq_single", "true_false"] when omitted.',
              items: {
                type: Type.STRING,
                enum: ['mcq_single', 'mcq_multi', 'true_false', 'short'],
              },
            },
            source: {
              type: Type.STRING,
              description:
                "Optional raw source text the user pasted in the chat (lecture notes, syllabus, article). Copy VERBATIM, do not paraphrase. ≤10000 chars. If you set this, the generator grounds every question in this text.",
            },
            useChannelNotes: {
              type: Type.BOOLEAN,
              description:
                "Set true ONLY when the user explicitly says to use their notes on this channel (e.g. 'from my notes', 'based on my notes'). When true, the runtime pulls the channel's note doc as grounding material.",
            },
          },
          required: ['channelId', 'title', 'topic', 'questionCount'],
        },
      },
    ],
  },
];

/**
 * Async generator that yields token deltas from a Gemini streaming
 * response. Wraps `models.generateContentStream` so the route layer
 * doesn't need to know about Google's chunk shape.
 *
 * Emits two event kinds:
 *   { kind: 'token', text }   — incremental text delta
 *   { kind: 'done', usage }    — final usage summary (best-effort;
 *                                empty object if the SDK didn't expose
 *                                usage on this chunk)
 *
 * Errors propagate. The route layer catches and writes an SSE
 * `{type:"error"}` event before closing the response.
 */
export interface StreamUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
  totalTokenCount?: number;
}

export type StreamEvent =
  | { kind: 'token'; text: string }
  | {
      kind: 'tool_call';
      name: string;
      args: Record<string, unknown>;
      /** The model's own `functionCall.id` if present on the chunk.
       *  Required to be echoed back on the matching `functionResponse`
       *  part across multi-turn exchanges — see the `modelCallId`
       *  field comment in `AiConversation.ts`. Optional because the
       *  SDK may omit it on older model versions; downstream code
       *  treats undefined as "no id" and tolerates the omission. */
      id?: string;
    }
  | { kind: 'done'; usage: StreamUsage };

interface StreamArgs {
  client: GoogleGenAI;
  systemPrompt: string;
  /**
   * Full multi-turn conversation as Gemini Content[]. The caller is
   * responsible for unfolding any prior tool calls into proper
   * `functionCall` / `functionResponse` parts — passing prose
   * summaries of past tool use breaks function-calling state on
   * follow-up turns ("another one at 2pm" → model replies "got it"
   * without invoking the tool).
   */
  contents: Content[];
}

export async function* streamPersonalAnswer(args: StreamArgs): AsyncGenerator<StreamEvent> {
  const { client, systemPrompt, contents } = args;

  // Gemini's `contents` is the canonical multi-turn channel. With
  // proper functionCall/functionResponse parts in history, tool-use
  // state survives across turns. The system instruction rides in
  // `config.systemInstruction`. Streaming response is an async
  // iterator of chunks shaped like `{ text, usageMetadata? }`.
  //
  // Tools are always attached — Gemini 2.x Flash handles
  // tools-plus-casual-chat in the same call. Tool choice stays
  // `auto` (the default): the model decides per turn whether to
  // call or just reply.
  const response = await client.models.generateContentStream({
    model: env.GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 1536,
      // 0.8 gives the model room to land the dry-confident voice
      // edges without slipping into incoherence.
      temperature: 0.8,
      tools: AI_TOOLS,
    },
  });

  let lastUsage: StreamUsage = {};
  let tokenChunks = 0;
  let toolCallCount = 0;
  let lastFinishReason: string | undefined;
  let iteratorError: unknown = undefined;

  // Wrap the SDK iterator in try so a mid-stream network blip, 429,
  // or malformed chunk doesn't drop the `done` event entirely — the
  // caller (`service.ts`) relies on `done` to persist the assistant
  // turn. We still surface the error to the caller via re-throw
  // after the diagnostic log + done event so it can emit a typed
  // `error` SSE event with the partial usage attached.
  try {
    for await (const chunk of response) {
      // `.text` is a getter that returns the concatenated text of all
      // text parts in the chunk. Skipping empty deltas keeps the SSE
      // stream tidy on chunks that only carry usage / safety metadata.
      const text = chunk.text;
      if (typeof text === 'string' && text.length > 0) {
        tokenChunks += 1;
        yield { kind: 'token', text };
      }
      // Tool calls arrive on the same chunk stream. `.functionCalls`
      // is a getter on `GenerateContentResponse` returning
      // `FunctionCall[] | undefined`; we surface each as its own
      // event so the route layer can run / defer it without parsing
      // the raw chunk shape. Multi-call chunks ARE supported by the
      // SDK shape — we already iterate the whole array.
      const functionCalls = chunk.functionCalls;
      if (Array.isArray(functionCalls)) {
        for (const call of functionCalls) {
          if (typeof call.name !== 'string') continue;
          const args = (call.args ?? {}) as Record<string, unknown>;
          // Capture the model's own id (Gemini 2.5+ emits this; older
          // models omit it). Echoing it back on the matching
          // `functionResponse` part is what keeps tool-state mapping
          // correct across multi-turn follow-ups like "another one at
          // 2pm" — without it, 2.5 drifts and 3 hard-errors.
          const id = typeof call.id === 'string' ? call.id : undefined;
          toolCallCount += 1;
          yield { kind: 'tool_call', name: call.name, args, id };
        }
      }
      // Capture `finishReason` if present — exposes why a stream
      // closed when it produced nothing (`SAFETY`, `OTHER`, etc).
      const candidates = chunk.candidates;
      if (Array.isArray(candidates) && candidates.length > 0) {
        const reason = candidates[0]?.finishReason;
        if (typeof reason === 'string') lastFinishReason = reason;
      }
      // The Gemini SDK attaches `usageMetadata` to chunks at varying
      // points in the stream — typically on the last chunk, but
      // occasionally earlier. We hold the most recent so the `done`
      // event carries the freshest snapshot regardless of which
      // chunk it arrived on.
      const usage = chunk.usageMetadata;
      if (usage) lastUsage = usage;
    }
  } catch (err) {
    iteratorError = err;
  }

  // If the model finished with a non-STOP reason and produced no
  // visible output (no text + no tool call), emit a synthetic
  // apology token so the UI has *something* to render. Without
  // this, the user sees a blank assistant turn for SAFETY /
  // RECITATION / OTHER / MAX_TOKENS finishes and has no way to
  // tell whether the request worked.
  if (tokenChunks === 0 && toolCallCount === 0 && lastFinishReason && lastFinishReason !== 'STOP') {
    const fallback = synthesizeFinishReasonMessage(lastFinishReason);
    if (fallback.length > 0) {
      yield { kind: 'token', text: fallback };
    }
  }

  // Diagnostic — fires once per stream. Empty completions
  // (tokenChunks=0, toolCallCount=0) surface `finishReason` so
  // we can see SAFETY / OTHER / MAX_TOKENS without parsing
  // chunks ourselves.
  logger.info(
    {
      tokenChunks,
      toolCallCount,
      finishReason: lastFinishReason,
      totalTokens: lastUsage.totalTokenCount,
      iteratorError: iteratorError instanceof Error ? iteratorError.message : iteratorError,
    },
    'ai: stream complete',
  );

  yield { kind: 'done', usage: lastUsage };

  // Re-throw after `done` so the caller's catch still fires and
  // emits an `error` SSE event — but the assistant turn has now
  // been persisted with whatever partial text/tool calls landed.
  if (iteratorError !== undefined) {
    throw iteratorError;
  }
}

/**
 * Turn a non-STOP `finishReason` into a short user-facing message.
 * Empty string means "don't say anything" — useful for reasons
 * that genuinely shouldn't surface to the UI. Kept terse so it
 * doesn't drown out a one-line "got it" reply on the rare turns
 * where a partial-then-stop happens.
 */
function synthesizeFinishReasonMessage(reason: string): string {
  switch (reason) {
    case 'SAFETY':
    case 'PROHIBITED_CONTENT':
    case 'BLOCKLIST':
    case 'SPII':
    case 'IMAGE_SAFETY':
    case 'IMAGE_PROHIBITED_CONTENT':
      return "Can't answer that one — safety filter tripped. Try rephrasing?";
    case 'RECITATION':
      return "Skipped that — looked too close to copyrighted text. Try asking in your own words.";
    case 'MAX_TOKENS':
      return "Ran out of room mid-thought. Ask me to continue or narrow the question?";
    case 'MALFORMED_FUNCTION_CALL':
    case 'UNEXPECTED_TOOL_CALL':
      return "Tool call came back malformed — try again or rephrase what you want done.";
    case 'LANGUAGE':
      return "Couldn't process that language. Try English?";
    case 'OTHER':
    case 'FINISH_REASON_UNSPECIFIED':
      return "Model bailed without producing a response. Try again?";
    default:
      return '';
  }
}

/**
 * One-shot logger for cache-related fallbacks. The provider call
 * itself never *attempts* explicit caching today — we log only
 * when we receive an unexpectedly-shaped usage payload that hints
 * caching ran but we couldn't read it. The flag prevents spamming
 * the log on every chunk.
 */
let warnedAboutCache = false;
export function maybeLogCacheGap(usage: StreamUsage): void {
  if (warnedAboutCache) return;
  if (usage.cachedContentTokenCount === undefined && usage.totalTokenCount !== undefined) {
    // Caching either isn't configured or isn't supported for this
    // model — neither is a failure, but it's useful telemetry.
    logger.debug(
      { usage },
      'ai: response carries no cachedContentTokenCount; caching not applied this turn',
    );
    warnedAboutCache = true;
  }
}
