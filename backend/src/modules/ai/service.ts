import { randomUUID } from 'node:crypto';

import { type Content } from '@google/genai';

import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { AiConversationMessage } from '../../db/models/index.js';
import {
  appendTurn,
  expireStalePendingToolCalls,
  recentTurns,
} from './conversation-service.js';
import { buildPersonalContext, type PersonalContextSources } from './context-builder.js';
import { registerPendingCall } from './pending-tool-store.js';
import { getGeminiClient } from './provider/gemini-client.js';
import { maybeLogCacheGap, streamPersonalAnswer } from './provider/stream-personal.js';
import type { AiScope } from './schemas.js';
import { isDestructive, runTool, TOOL_NAMES, type ToolName } from './tool-runner.js';

/**
 * Async-generator service interface — the route layer pipes these
 * events into an SSE response. Stays scope-agnostic so the future
 * channel / server / voice handlers can yield the same shape.
 */
export type AskEvent =
  | { kind: 'token'; text: string }
  | { kind: 'sources'; sources: PersonalContextSources }
  | {
      kind: 'tool_call';
      callId: string;
      name: ToolName;
      args: Record<string, unknown>;
      needsConfirmation: boolean;
    }
  | {
      kind: 'tool_result';
      callId: string;
      result: Record<string, unknown> | null;
      error: string | null;
    }
  | { kind: 'done'; usage: Record<string, number | undefined> }
  | { kind: 'error'; code: string; message: string };

function isKnownToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

interface AskArgs {
  userId: string;
  scope: AiScope;
  scopeId?: string;
  question: string;
  /** IANA timezone of the caller (e.g. 'Africa/Cairo'). Used to
   *  anchor relative-time phrases ("tomorrow 9am") to the user's
   *  local clock instead of UTC. */
  timezone?: string;
}

/**
 * Dispatch entry point. Selects the per-scope handler. v1 only
 * implements `personal`; the others throw a 501 so a client adding
 * them early sees a clear "not implemented" error rather than a
 * silent fall-through.
 */
export async function* ask(args: AskArgs): AsyncGenerator<AskEvent> {
  switch (args.scope) {
    case 'personal':
      yield* askPersonal(args);
      return;
    case 'channel':
    case 'server':
    case 'voice':
      throw new AppError(
        501,
        'scope_not_implemented',
        `AI scope "${args.scope}" is not implemented yet`,
      );
    default: {
      // Exhaustiveness check — `args.scope` is typed as `AiScope`,
      // so this branch is unreachable unless we add a new value to
      // the union without handling it here.
      const exhaustive: never = args.scope;
      throw new AppError(500, 'scope_unknown', `Unknown AI scope: ${String(exhaustive)}`);
    }
  }
}

/**
 * Personal-scope handler. Builds the context for the caller, opens
 * a Gemini stream, and re-yields events as scope-agnostic
 * `AskEvent`s.
 *
 * Always yields a `sources` event before the first token so the UI
 * can render citation chips as text streams in.
 */
async function* askPersonal(args: AskArgs): AsyncGenerator<AskEvent> {
  const client = getGeminiClient(); // throws 503 if not configured

  // Persist the user turn BEFORE streaming starts so a mid-stream
  // disconnect still leaves the question in history. The assistant
  // turn is appended at `done` when the full text + sources are
  // known.
  await appendTurn({
    userId: args.userId,
    scope: 'personal',
    role: 'user',
    text: args.question,
  });

  const ctx = await buildPersonalContext({
    userId: args.userId,
    question: args.question,
    timezone: args.timezone,
  });

  yield { kind: 'sources', sources: ctx.sources };

  // Build Gemini's `contents` array. Routing is driven by `ctx.mode`
  // from the context builder — see `AiMode` there for the three
  // tiers and why each one has the shape it does.
  //
  //   greeting     — 0 history turns,  bare current user turn.
  //                  Fresh-slate greetings; nothing for in-context
  //                  learning to inherit from.
  //   conversation — 6 history turns,  bare current user turn.
  //                  Vent threads / elliptical replies. Bare current
  //                  turn matches the bare-text shape of every prior
  //                  user turn in history, so the model reads short
  //                  follow-ups ("whaaaat", "not me") as
  //                  continuations of the thread instead of
  //                  isolated fresh queries.
  //   grounded     — 11 history turns, structured current user turn
  //                  (NOW + data blocks + tail) so the model can
  //                  cite sources and resolve relative time. Larger
  //                  window because tool-use state preservation
  //                  needs more turns (functionCall/Response pairs
  //                  unfold to 2-3 contents entries each).
  //
  // History windows are also small enough to keep in-context-learning
  // contamination bounded — a single past bad assistant turn can't
  // dominate when there are 5-10 well-anchored few-shots in the
  // system prompt either side of it.
  const historyN = ctx.mode === 'greeting' ? 0 : ctx.mode === 'conversation' ? 6 : 11;

  const contents: Content[] = [];

  // Prepend few-shot voice anchors as past conversation turn pairs.
  // These USED to live in `systemInstruction` but small models read
  // them there as a memorized Q→A lookup table and copy replies
  // verbatim. Riding in `contents` as past turns, the model reads
  // them as "this is how I tend to talk" — style precedent, not
  // canned answers. Identical reference per request so the API's
  // implicit prefix cache amortizes the cost after the first hit.
  contents.push(...ctx.prefillContents);

  if (historyN > 0) {
    // Sweep stale pending tool calls BEFORE reading history. A
    // pending_confirmation call older than an hour is a call the
    // user clearly walked away from; if we leave it as-is, the
    // `turnToContents` filter below drops it, which leaves an
    // unpaired `functionCall` part from a prior model turn in
    // Gemini's history → protocol error on Gemini 3 and degraded
    // behavior on 2.x. Flipping to `declined` lets `turnToContents`
    // emit the matching `functionResponse({ declined: true })`.
    await expireStalePendingToolCalls(
      { userId: args.userId, scope: 'personal' },
      60 * 60 * 1000,
    );
    const allTurns = await recentTurns(
      { userId: args.userId, scope: 'personal' },
      historyN,
    );
    const priorTurns = allTurns.slice(0, -1);
    for (const turn of priorTurns) {
      contents.push(...turnToContents(turn));
    }
  }
  contents.push({ role: 'user', parts: [{ text: ctx.user }] });

  let assistantText = '';
  const toolCallsForTurn: Array<{
    callId: string;
    /** The model's own `functionCall.id`. Captured here so `appendTurn`
     *  persists it on the assistant turn, and `turnToContents` can echo
     *  it back on the matching `functionResponse` part next turn. */
    modelCallId?: string;
    name: ToolName;
    args: Record<string, unknown>;
    status: 'pending_confirmation' | 'executed' | 'failed' | 'declined';
    result?: Record<string, unknown> | null;
    error?: string | null;
  }> = [];

  try {
    for await (const event of streamPersonalAnswer({
      client,
      systemPrompt: ctx.system,
      contents,
    })) {
      if (event.kind === 'token') {
        assistantText += event.text;
        yield { kind: 'token', text: event.text };
      } else if (event.kind === 'tool_call') {
        if (!isKnownToolName(event.name)) {
          logger.warn({ name: event.name }, 'ai: model invoked unknown tool; ignoring');
          continue;
        }
        if (isDestructive(event.name)) {
          // Destructive — defer to user confirmation. Register a
          // pending call so the confirm endpoint can replay it.
          // Capture the caller's timezone so naive ISO times the
          // model emitted normalize against the same zone whether
          // run inline or after confirmation. Capture the model's
          // own `event.id` so when the user confirms later we can
          // echo it on the `functionResponse` part — Gemini 2.5+
          // uses it to map responses to calls across turns.
          const callId = registerPendingCall({
            userId: args.userId,
            name: event.name,
            args: event.args,
            timezone: args.timezone,
            modelCallId: event.id,
          });
          toolCallsForTurn.push({
            callId,
            modelCallId: event.id,
            name: event.name,
            args: event.args,
            status: 'pending_confirmation',
          });
          yield {
            kind: 'tool_call',
            callId,
            name: event.name,
            args: event.args,
            needsConfirmation: true,
          };
        } else {
          // Non-destructive (createCalendarEvent) — execute now.
          try {
            const { result } = await runTool({
              userId: args.userId,
              name: event.name,
              args: event.args,
              timezone: args.timezone,
            });
            const callId = `inline-${randomUUID()}`;
            toolCallsForTurn.push({
              callId,
              modelCallId: event.id,
              name: event.name,
              args: event.args,
              status: 'executed',
              result,
            });
            yield {
              kind: 'tool_call',
              callId,
              name: event.name,
              args: event.args,
              needsConfirmation: false,
            };
            yield { kind: 'tool_result', callId, result, error: null };
          } catch (toolErr) {
            const callId = `inline-${randomUUID()}`;
            const message = toolErr instanceof Error ? toolErr.message : 'tool_failed';
            toolCallsForTurn.push({
              callId,
              modelCallId: event.id,
              name: event.name,
              args: event.args,
              status: 'failed',
              error: message,
            });
            yield { kind: 'tool_call', callId, name: event.name, args: event.args, needsConfirmation: false };
            yield { kind: 'tool_result', callId, result: null, error: message };
          }
        }
      } else if (event.kind === 'done') {
        maybeLogCacheGap(event.usage);
        // Capture the assistant turn with the cited subset of
        // sources — denormalised so chip labels survive renames.
        await appendTurn({
          userId: args.userId,
          scope: 'personal',
          role: 'assistant',
          text: assistantText,
          sources: filterCitedSources(ctx.sources, assistantText, toolCallsForTurn),
          toolCalls: toolCallsForTurn.length > 0 ? toolCallsForTurn : undefined,
        });
        yield {
          kind: 'done',
          usage: {
            promptTokenCount: event.usage.promptTokenCount,
            candidatesTokenCount: event.usage.candidatesTokenCount,
            cachedContentTokenCount: event.usage.cachedContentTokenCount,
            totalTokenCount: event.usage.totalTokenCount,
          },
        };
      }
    }
  } catch (err) {
    logger.warn({ err, userId: args.userId }, 'ai: personal stream failed');
    yield {
      kind: 'error',
      code: 'stream_failed',
      message: err instanceof Error ? err.message : 'stream_failed',
    };
  }
}

/**
 * Map one stored conversation message to its Gemini Content
 * representation. Assistant turns with resolved tool calls unfold
 * into three Content entries (model→functionCall, user→
 * functionResponse, model→text) so the model sees a proper
 * tool-use sequence in history. Tool calls still pending user
 * confirmation are skipped — emitting an unmatched functionCall
 * without a functionResponse breaks Gemini's protocol.
 */
function turnToContents(turn: AiConversationMessage): Content[] {
  if (turn.role === 'user') {
    return [{ role: 'user', parts: [{ text: turn.text }] }];
  }
  const resolved = (turn.toolCalls ?? []).filter(
    (c) => c.status === 'executed' || c.status === 'failed' || c.status === 'declined',
  );
  const out: Content[] = [];
  if (resolved.length > 0) {
    // Echo the model's own `functionCall.id` (when we captured it)
    // on BOTH the functionCall and functionResponse parts. Gemini 2.5+
    // uses this id to map responses back to calls across multi-turn
    // exchanges; 3 hard-errors on missing ids. We omit the field
    // entirely when undefined (legacy rows from before this plumbing
    // existed) — 2.5 tolerates that for unpaired-by-id walks, but the
    // freshly-captured ids on new rows give us the correct behavior
    // going forward.
    out.push({
      role: 'model',
      parts: resolved.map((c) => ({
        functionCall: {
          ...(c.modelCallId ? { id: c.modelCallId } : {}),
          name: c.name,
          args: c.args,
        },
      })),
    });
    out.push({
      role: 'user',
      parts: resolved.map((c) => ({
        functionResponse: {
          ...(c.modelCallId ? { id: c.modelCallId } : {}),
          name: c.name,
          response:
            c.status === 'executed'
              ? (c.result ?? {})
              : c.status === 'declined'
                ? { declined: true }
                : { error: c.error ?? 'tool_failed' },
        },
      })),
    });
  }
  if (turn.text.length > 0) {
    out.push({ role: 'model', parts: [{ text: turn.text }] });
  }
  return out;
}

/**
 * Mirror of the frontend's `filterCitedSources` — kept here so we
 * can persist only the chips the AI actually referenced. Avoids
 * stuffing every retrieved row into the turn history.
 */
const CITATION_RE = /\[(note|event|attempt|activity|quiz):([\w-]+)\]/g;

interface CitedSource {
  kind: 'note' | 'event' | 'attempt' | 'activity' | 'quiz';
  id: string;
  title: string;
  /** Set only for events — lets the frontend open the inline
   *  calendar pane scoped to the cited day on chip / badge click. */
  startAt?: string;
  /** Set only for quizzes — channelId the quiz belongs to so the
   *  frontend can build the deep link to the workshop. Captured at
   *  filter-time from the matching `generateExam` tool result on the
   *  same assistant turn. */
  channelId?: string;
}

interface TurnToolCall {
  callId: string;
  name: ToolName;
  args: Record<string, unknown>;
  status: 'pending_confirmation' | 'executed' | 'failed' | 'declined';
  result?: Record<string, unknown> | null;
}

function filterCitedSources(
  sources: PersonalContextSources,
  responseText: string,
  toolCalls: TurnToolCall[],
): CitedSource[] {
  const cited = new Set<string>();
  for (const match of responseText.matchAll(CITATION_RE)) {
    cited.add(`${match[1]}:${match[2]}`);
  }
  if (cited.size === 0) return [];
  const out: CitedSource[] = [];
  for (const n of sources.notes) {
    if (cited.has(`note:${n.channelId}`)) out.push({ kind: 'note', id: n.channelId, title: n.title });
  }
  for (const e of sources.events) {
    if (cited.has(`event:${e.id}`)) {
      out.push({ kind: 'event', id: e.id, title: e.title, startAt: e.startAt });
    }
  }
  for (const a of sources.attempts) {
    if (cited.has(`attempt:${a.id}`)) out.push({ kind: 'attempt', id: a.id, title: a.title });
  }
  for (const v of sources.activities) {
    if (cited.has(`activity:${v.channelId}`)) {
      out.push({ kind: 'activity', id: v.channelId, title: v.title });
    }
  }
  // Quiz citations have no entry in the retrieved-sources array — they
  // refer to a quiz the AI itself just created via a generateExam tool
  // call on this very turn. Pull channelId + title out of the matching
  // tool result so the persisted chip carries enough info for the
  // frontend to build the workshop deep link.
  for (const call of toolCalls) {
    if (call.name !== 'generateExam' || call.status !== 'executed') continue;
    const result = call.result;
    if (!result) continue;
    const quizId = typeof result.quizId === 'string' ? result.quizId : null;
    const channelId = typeof result.channelId === 'string' ? result.channelId : null;
    const title = typeof result.title === 'string' ? result.title : 'Untitled quiz';
    if (!quizId || !channelId) continue;
    if (cited.has(`quiz:${quizId}`)) {
      out.push({ kind: 'quiz', id: quizId, title, channelId });
    }
  }
  return out;
}

/**
 * Future scope context-builder TODOs (kept in code so they survive
 * code search; remove each entry when its scope ships):
 *
 *   channel   — buildChannelContext({ userId, channelId })
 *     - Verify the user is a member of `channelId` once the channels
 *       module lands (currently no membership table to check against).
 *     - Pull `Message.find({ channelId }).sort(-createdAt).limit(50)`
 *       (chronological after reversal) for the transcript.
 *     - Pull this channel's `ChannelNotes` doc + `ChannelWhiteboard`
 *       text shapes for the notes/whiteboard preamble.
 *     - Citations: [msg:<uuid>], [note:<channelId>], [shape:<id>].
 *
 *   server    — buildServerContext({ userId, serverId })
 *     - For every channel in the server the user has access to, pull
 *       the last 10 messages + the notes head. Aggregate, dedup by
 *       channel, cap at ~16 channels.
 *     - Citations: [channel:<id>] alongside the per-source ids above.
 *
 *   voice     — buildVoiceContext({ userId, roomId })
 *     - Bound to the LiveKit room the user is currently in. Pull the
 *       recent transcript snippets (requires a transcription source
 *       we don't have yet) + the room's pinned notes.
 *     - Citations: [voice:<timestamp>] + [note:<channelId>].
 */
