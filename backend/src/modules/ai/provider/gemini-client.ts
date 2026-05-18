import { GoogleGenAI } from '@google/genai';

import { env } from '../../../lib/env.js';
import { AppError } from '../../../lib/errors.js';

/**
 * Singleton Gemini client. Lazily instantiated on first use so a missing
 * GOOGLE_API_KEY only surfaces when the AI surface is actually invoked —
 * the rest of the app boots cleanly without the key (same posture as
 * Stripe / Spotify / LiveKit).
 */
let cached: GoogleGenAI | null = null;

export function isAiConfigured(): boolean {
  return Boolean(env.GOOGLE_API_KEY);
}

export function getGeminiClient(): GoogleGenAI {
  if (!env.GOOGLE_API_KEY) {
    throw new AppError(
      503,
      'ai_not_configured',
      'AI is not configured. Set GOOGLE_API_KEY in backend/.env to enable.',
    );
  }
  if (cached) return cached;
  cached = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
  return cached;
}

/** Test-only — lets tests reset the cached client between runs. */
export function __resetGeminiClientForTests(): void {
  cached = null;
}
