import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';

// ── Env-var guard ────────────────────────────────────────────────────────────
const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const supabaseKey = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined;

if (!supabaseUrl || supabaseUrl.trim() === '') {
  throw new Error(
    '[wiscord] Missing VITE_SUPABASE_URL. Add it to .env.local and restart the dev server.',
  );
}
if (!supabaseKey || supabaseKey.trim() === '') {
  throw new Error(
    '[wiscord] Missing VITE_SUPABASE_PUBLISHABLE_KEY. Add it to .env.local and restart the dev server.',
  );
}

// ── Supabase client ──────────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ── TanStack QueryClient ─────────────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000, // 5 minutes default; override per query
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ── Edge Function invoker ────────────────────────────────────────────────────
export async function invokeEdgeFunction<TResp>(name: string, body: Record<string, unknown>): Promise<TResp> {
  const { data, error } = await supabase.functions.invoke<TResp>(name, {
    body,
  });

  if (error) {
    throw new Error(`[wiscord] Edge Function "${name}" failed: ${error.message}`);
  }

  if (data === null) {
    throw new Error(`[wiscord] Edge Function "${name}" returned null data.`);
  }

  return data;
}
