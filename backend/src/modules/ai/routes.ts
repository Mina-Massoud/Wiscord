import { Router, type Response } from 'express';

import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  loadConversation,
  resetConversation,
  resolveToolCall,
} from './conversation-service.js';
import { getNotePlaintext } from './notes-plaintext.js';
import { consumePendingCall } from './pending-tool-store.js';
import { isAiConfigured } from './provider/gemini-client.js';
import { ask, type AskEvent } from './service.js';
import { askBodySchema, confirmToolBodySchema } from './schemas.js';
import { runConfirmedTool } from './tool-runner.js';
import { ChannelNotes, User } from '../../db/models/index.js';
import { notFound } from '../../lib/errors.js';
import { resolveEffectiveTier } from '../billing/effective-tier.js';
import { assertWithinQuota, classifyRequestKind, getQuotaStatus } from './quota.js';
import { utcDateBucket } from '../../db/models/index.js';

/**
 * Read the caller's EFFECTIVE subscription tier. Honors the post-cancel
 * grace window — a user who cancelled but is still inside the paid
 * billing period stays on Pro until `currentPeriodEnd` lapses. Defaults
 * to `free` for missing billing subdocs (legacy rows) or unexpected
 * status values. Used by /ai/ask for both quota enforcement and
 * model selection, and by /ai/quota so the displayed limits match.
 *
 * Implementation lives in `billing/effective-tier.ts` — see that file
 * for the full status table and the chargeback-risk rationale.
 */
async function resolveTier(userId: string): Promise<'free' | 'pro'> {
  const user = await User.findById(userId)
    .select(
      'billing.subscriptionTier billing.subscriptionStatus billing.currentPeriodEnd',
    )
    .lean();
  return resolveEffectiveTier(user?.billing);
}

/**
 * Read the caller's voice vibe. Defaults to `genz` (the historic
 * Wiscord default) when the user doc is missing the field or
 * carries something unexpected — keeps existing users on the original
 * voice without forcing a backfill.
 */
async function resolveVibe(userId: string): Promise<'genz' | 'chill' | 'professional'> {
  const user = await User.findById(userId).select('vibe').lean();
  const value = user?.vibe;
  if (value === 'chill' || value === 'professional' || value === 'genz') return value;
  return 'genz';
}

export const aiRouter: Router = Router();

/**
 * Server-side heartbeat interval. Most proxy stacks (nginx default,
 * Cloudflare free tier) close idle connections somewhere between
 * 60s and 100s. 25s keeps us comfortably under that without
 * meaningfully inflating bytes-on-wire.
 */
const SSE_HEARTBEAT_MS = 25_000;

/**
 * POST /ai/ask
 * Body: { question, scope?, scopeId? }
 *
 * Server-Sent Events stream. Each event payload mirrors the legacy
 * `ai-ask` Edge Function so the frontend reader stays one shape
 * across scopes:
 *
 *   data: {"type":"sources","sources":{...}}
 *   data: {"type":"token","text":"..."}
 *   data: {"type":"done","usage":{...}}
 *   data: {"type":"error","message":"..."}
 *
 * Scope `personal` is implemented today; `channel` / `server` /
 * `voice` return a single `error` event with code `scope_not_implemented`
 * so the client doesn't have to special-case 501s vs streams.
 */
/**
 * GET /ai/conversation
 * Returns the caller's personal conversation (auto-creates if
 * missing). For v1 there's one conversation per user; future
 * scopes will take `?scope=channel&scopeId=...` query params.
 */
aiRouter.get('/conversation', requireAuth, async (req, res, next) => {
  try {
    const conversation = await loadConversation({
      userId: req.userId!,
      scope: 'personal',
      scopeId: null,
    });
    res.json(
      ok({
        scope: 'personal' as const,
        scopeId: null,
        messages: conversation.messages.map((m) => ({
          role: m.role,
          text: m.text,
          sources: m.sources ?? [],
          toolCalls: m.toolCalls ?? [],
          createdAt: m.createdAt.toISOString(),
        })),
      }),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * POST /ai/conversation/reset
 * Wipes the caller's personal conversation. The doc itself stays
 * (cheap, keeps the index entry) — only the messages array is
 * cleared. Returns the fresh empty state. Idempotent: replaying the
 * call on an already-empty conversation is a no-op that still
 * returns 200.
 */
aiRouter.post('/conversation/reset', requireAuth, async (req, res, next) => {
  try {
    await resetConversation({ userId: req.userId!, scope: 'personal', scopeId: null });
    res.json(ok({ scope: 'personal' as const, scopeId: null, messages: [] }));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /ai/sources/note/:channelId
 * Returns the Yjs notes doc as plaintext for inline rendering in
 * the AI capsule's source pane. Auth-gated; future-gated against
 * channel membership once the channels module ships.
 */
aiRouter.get('/sources/note/:channelId', requireAuth, async (req, res, next) => {
  try {
    const channelId = String(req.params.channelId ?? '');
    if (channelId.length === 0) {
      throw new AppError(400, 'invalid_input', 'channelId is required');
    }
    const row = await ChannelNotes.findOne({ channelId });
    // Distinct `note_not_found` code (not the generic `not_found`) so
    // the frontend can render "this note was deleted" instead of a
    // generic "couldn't load" message. The frontend's AiInlineNoteView
    // branches on `code === 'note_not_found'` for the dedicated copy.
    if (!row) throw new AppError(404, 'note_not_found', `note ${channelId} not found`);
    const plaintext = await getNotePlaintext(channelId);
    res.json(
      ok({
        channelId,
        plaintext,
        updatedAt: row.updatedAt?.toISOString() ?? null,
        updatedBy: row.updatedBy ?? null,
      }),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * GET /ai/quota
 * Returns the caller's daily AI usage counters per kind. Frontend
 * uses this to render "X messages left today" hints and to gate UI
 * affordances (e.g. dim the URL note CTA at 0 remaining).
 */
aiRouter.get('/quota', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const tier = await resolveTier(userId);
    const today = utcDateBucket();
    const status = await getQuotaStatus({ userId, tier, today });
    res.json(ok({ tier, quotas: status }));
  } catch (err) {
    next(err);
  }
});

aiRouter.post('/ask', requireAuth, async (req, res, next) => {
  try {
    const body = askBodySchema.parse(req.body);

    if (!isAiConfigured()) {
      throw new AppError(
        503,
        'ai_not_configured',
        'AI is not configured. Set GOOGLE_API_KEY in backend/.env to enable.',
      );
    }

    const userId = req.userId!;
    const [tier, vibe] = await Promise.all([resolveTier(userId), resolveVibe(userId)]);

    // Quota gate BEFORE opening SSE headers. A 402 here lands as a
    // normal JSON error response (envelope shape with details), which
    // is much easier for the frontend to branch on than a mid-stream
    // SSE error event. Once we've written SSE headers, every error
    // must be an SSE error event — there's no way back.
    //
    // `today` is computed once and threaded through both the gate's
    // atomic reservation and the eventual `recordUsage` write, so a
    // stream that straddles UTC midnight can't gate against yesterday
    // and write against today (which would silently refund the slot).
    const today = utcDateBucket();
    const requestKind = classifyRequestKind(body.question);
    await assertWithinQuota({ userId, tier, kind: requestKind, today });

    openSseHeaders(res);

    const abort = new AbortController();

    // Heartbeat keeps proxies from killing the idle connection
    // during a long generation. SSE comments (lines beginning with
    // `:`) are ignored by browser EventSource — perfect noop ping.
    const heartbeat = setInterval(() => {
      if (res.writableEnded || abort.signal.aborted) return;
      try {
        res.write(`: ping\n\n`);
      } catch {
        // Socket closed under us — let `req.on('close')` handle
        // the abort sequence.
      }
    }, SSE_HEARTBEAT_MS);
    heartbeat.unref?.();

    req.on('close', () => {
      abort.abort();
      clearInterval(heartbeat);
    });

    try {
      for await (const event of ask({
        userId,
        scope: body.scope,
        scopeId: body.scopeId,
        question: body.question,
        timezone: body.timezone,
        tier,
        vibe,
        today,
      })) {
        if (abort.signal.aborted || res.writableEnded) break;
        writeSseEvent(res, toWireEvent(event));
        // The service yields `done` first, then `quota` (post-write
        // so the count is fresh). Break only after quota or error —
        // breaking on `done` would suppress the quota event the
        // frontend needs to update its remaining counters.
        if (event.kind === 'quota' || event.kind === 'error') break;
      }
    } catch (err) {
      // Mid-stream failure: send a single error event then close.
      // This covers AppError(501) for unimplemented scopes too.
      const code = err instanceof AppError ? err.code : 'stream_failed';
      const message = err instanceof Error ? err.message : 'stream_failed';
      logger.warn({ err, userId }, 'ai: stream aborted with error');
      if (!res.writableEnded) {
        writeSseEvent(res, { type: 'error', code, message });
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * SSE wire format — kept compatible with the legacy `ai-ask` Edge
 * Function event names so the frontend reader doesn't need a switch
 * on scope.
 */
type WireEvent =
  | { type: 'sources'; sources: unknown }
  | { type: 'token'; text: string }
  | {
      type: 'tool_call';
      callId: string;
      name: string;
      args: Record<string, unknown>;
      needsConfirmation: boolean;
    }
  | {
      type: 'tool_result';
      callId: string;
      result: Record<string, unknown> | null;
      error: string | null;
    }
  | { type: 'done'; usage: Record<string, number | undefined> }
  | {
      type: 'quota';
      tier: 'free' | 'pro';
      quotas: Array<{
        kind: string;
        limit: number;
        used: number;
        remaining: number;
        resetAt: string;
      }>;
    }
  | { type: 'error'; code: string; message: string };

function toWireEvent(event: AskEvent): WireEvent {
  switch (event.kind) {
    case 'sources':
      return { type: 'sources', sources: event.sources };
    case 'token':
      return { type: 'token', text: event.text };
    case 'tool_call':
      return {
        type: 'tool_call',
        callId: event.callId,
        name: event.name,
        args: event.args,
        needsConfirmation: event.needsConfirmation,
      };
    case 'tool_result':
      return {
        type: 'tool_result',
        callId: event.callId,
        result: event.result,
        error: event.error,
      };
    case 'done':
      return { type: 'done', usage: event.usage };
    case 'quota':
      return { type: 'quota', tier: event.tier, quotas: event.quotas };
    case 'error':
      return { type: 'error', code: event.code, message: event.message };
  }
}

/**
 * POST /ai/tools/confirm/:callId
 * Body: { action: 'confirm' | 'decline' }
 *
 * Runs (or drops) a tool call the AI queued behind a confirmation.
 * The pending-call store is single-use and TTL'd at 5min, so a
 * stale confirm 404s cleanly.
 */
aiRouter.post('/tools/confirm/:callId', requireAuth, async (req, res, next) => {
  try {
    const callId = String(req.params.callId ?? '');
    if (callId.length === 0) throw notFound('pending_call');
    const { action } = confirmToolBodySchema.parse(req.body ?? {});
    const pending = consumePendingCall(callId, req.userId!);
    if (!pending) throw notFound('pending_call');
    const key = { userId: req.userId!, scope: 'personal' as const };
    if (action === 'decline') {
      // Persist the decline on the original assistant turn so the
      // next conversation turn ships a paired functionCall +
      // functionResponse({declined:true}) to Gemini — otherwise the
      // call sits as pending_confirmation in history, gets filtered
      // out, and the model thinks it never asked.
      await resolveToolCall({ key, callId, status: 'declined' });
      res.json(ok({ callId, declined: true }));
      return;
    }
    try {
      const { result } = await runConfirmedTool({
        userId: req.userId!,
        name: pending.name,
        args: pending.args,
        timezone: pending.timezone,
      });
      await resolveToolCall({ key, callId, status: 'executed', result });
      res.json(ok({ callId, result }));
    } catch (toolErr) {
      const message = toolErr instanceof Error ? toolErr.message : 'tool_failed';
      // Persist the failure so history reflects it. We still re-throw
      // so the user sees the failure response — but the model's
      // history now correctly says "you asked, you got a failure",
      // not "you asked and nothing happened".
      await resolveToolCall({ key, callId, status: 'failed', error: message });
      throw toolErr;
    }
  } catch (err) {
    next(err);
  }
});

function openSseHeaders(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable proxy buffering (nginx/cloudflare) so deltas hit the
  // browser as soon as the stream produces them.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function writeSseEvent(res: Response, payload: WireEvent): void {
  if (res.writableEnded) return;
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch (err) {
    // Socket likely closed between our writableEnded check and the
    // write. Log at warn so it's visible but not a true error.
    logger.warn({ err }, 'ai: SSE write failed after socket close');
  }
}
