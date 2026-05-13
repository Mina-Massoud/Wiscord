// ai-ask — room-scoped AI assistant.
//
// Accepts a question + channel_id, fetches that channel's recent messages
// and notes snapshot (RLS gates access via the user's JWT), then streams an
// Anthropic Haiku 4.5 response back as Server-Sent Events.
//
// Each SSE event payload is `{ type: "token" | "done" | "error", ... }`.
// The frontend reads `text` chunks and renders citations of the form
// `[msg:<uuid>]` as inline chips.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonError(status: number, code: string, message?: string): Response {
  return new Response(
    JSON.stringify({ error: code, message: message ?? code }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

const MODEL = "claude-haiku-4-5-20251001";
const MAX_OUTPUT_TOKENS = 1024;
const MAX_CONTEXT_MESSAGES = 50;
const MAX_QUESTION_CHARS = 2000;

interface AskRequest {
  channel_id: string;
  question: string;
  message_limit?: number;
}

interface ChannelRow {
  id: string;
  name: string;
  server_id: string;
}

interface NotesRow {
  content: string;
}

interface MessageRow {
  id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  profiles: { username: string | null } | null;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== "POST") return jsonError(405, "method_not_allowed");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError(401, "missing_authorization");

  let body: AskRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json");
  }

  if (!body.channel_id || !body.question) {
    return jsonError(400, "missing_required_fields");
  }
  if (body.question.length > MAX_QUESTION_CHARS) {
    return jsonError(400, "question_too_long");
  }

  const messageLimit = Math.min(
    body.message_limit ?? MAX_CONTEXT_MESSAGES,
    MAX_CONTEXT_MESSAGES,
  );

  // Supabase client forwarding the user's JWT so every read is RLS-gated.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // Verify channel access. RLS would silently return empty rows; this gives
  // a clearer error.
  const { data: channel, error: channelErr } = await supabase
    .from("channels")
    .select("id, name, server_id")
    .eq("id", body.channel_id)
    .single<ChannelRow>();

  if (channelErr || !channel) {
    return jsonError(403, "channel_not_accessible");
  }

  // Pull recent messages (chronological after reversal). Embed author username
  // so the AI can attribute lines.
  const { data: rawMessages, error: messagesErr } = await supabase
    .from("messages")
    .select(
      "id, author_id, content, created_at, profiles!messages_author_id_fkey(username)",
    )
    .eq("channel_id", body.channel_id)
    .order("created_at", { ascending: false })
    .limit(messageLimit)
    .returns<MessageRow>();

  if (messagesErr) return jsonError(500, "messages_fetch_failed");

  const messages = (rawMessages ?? []).slice().reverse();

  // Notes snapshot is optional — channel may not have one yet.
  const { data: notes } = await supabase
    .from("notes_snapshots")
    .select("content")
    .eq("channel_id", body.channel_id)
    .maybeSingle<NotesRow>();

  const transcript = messages
    .map(
      (m: MessageRow) =>
        `[msg:${m.id}] ${m.profiles?.username ?? "unknown"}: ${m.content}`,
    )
    .join("\n");

  const notesContent = (notes?.content ?? "").trim() || "(no notes yet)";

  // System prompt is static across queries → cache it.
  const systemPrompt = `You are the study assistant for a Wiscord channel — a Discord-style room where a small group studies together.

Answer the user's question using ONLY the chat history and shared notes from this room. If the answer isn't supported by the room's context, say so clearly — don't invent facts.

When you draw on a specific message, cite it inline using its message id in the form [msg:<uuid>] (the same form you see in the transcript). The UI renders these as clickable chips. Notes content doesn't need a citation.

Keep answers tight — usually 1–3 short paragraphs. Match the room's vibe: technical if they're studying DSA, warm if they're prepping IELTS. Never preach or pad.`;

  const userPrompt = `Channel: ${channel.name}

=== SHARED NOTES ===
${notesContent}

=== RECENT MESSAGES (oldest first) ===
${transcript || "(no messages yet)"}

=== QUESTION ===
${body.question}`;

  const anthropic = new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
  });

  const encoder = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      const enqueue = (payload: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );
      };

      try {
        const stream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: userPrompt }],
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            enqueue({ type: "token", text: event.delta.text });
          }
        }

        const final = await stream.finalMessage();
        enqueue({
          type: "done",
          usage: {
            input_tokens: final.usage.input_tokens,
            output_tokens: final.usage.output_tokens,
            cache_read_input_tokens: final.usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens:
              final.usage.cache_creation_input_tokens ?? 0,
          },
        });
      } catch (err) {
        enqueue({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
