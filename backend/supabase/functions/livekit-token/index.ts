// livekit-token — mints a short-lived LiveKit access token scoped to a
// single voice channel's room. The token grants publish + subscribe on the
// room `channel-<channel_id>`. Channel membership is enforced via RLS on
// the channels table (we fail the request if the channel isn't readable).

import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

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

interface TokenRequest {
  channel_id: string;
}

interface ChannelRow {
  id: string;
  type: "text" | "voice";
  name: string;
  server_id: string;
}

interface ProfileRow {
  username: string | null;
  display_name: string | null;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== "POST") return jsonError(405, "method_not_allowed");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError(401, "missing_authorization");

  let body: TokenRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json");
  }

  if (!body.channel_id) return jsonError(400, "missing_channel_id");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // Identify the calling user.
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return jsonError(401, "invalid_token");

  // RLS gates the read — non-members get an empty result.
  const { data: channel, error: channelErr } = await supabase
    .from("channels")
    .select("id, type, name, server_id")
    .eq("id", body.channel_id)
    .single<ChannelRow>();

  if (channelErr || !channel) return jsonError(403, "channel_not_accessible");
  if (channel.type !== "voice") return jsonError(400, "not_a_voice_channel");

  // Friendly display name for the LiveKit participant tile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single<ProfileRow>();

  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const wsUrl = Deno.env.get("LIVEKIT_URL");

  if (!apiKey || !apiSecret || !wsUrl) {
    return jsonError(500, "livekit_not_configured");
  }

  const roomName = `channel-${channel.id}`;
  const participantName =
    profile?.display_name?.trim() || profile?.username || "Guest";

  const at = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: participantName,
    ttl: "1h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return new Response(
    JSON.stringify({
      token,
      url: wsUrl,
      room: roomName,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
