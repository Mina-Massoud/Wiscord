import { describe, expect, test } from 'vitest';

import {
  composeSystemPrompt,
  getVoiceBundle,
  type Vibe,
} from '../../src/modules/ai/voice.js';

const ALL_VIBES: Vibe[] = ['genz', 'chill', 'professional'];

describe('voice bundles registry', () => {
  test('every vibe resolves to a non-empty rules block + prefill', () => {
    for (const vibe of ALL_VIBES) {
      const bundle = getVoiceBundle(vibe);
      expect(bundle.voiceRules.length).toBeGreaterThan(200);
      expect(bundle.prefillContents.length).toBeGreaterThan(0);
      // Every prefill turn is a `user` or `model` Content with at
      // least one text part — otherwise Gemini rejects the contents
      // array with a parts-required error.
      for (const turn of bundle.prefillContents) {
        expect(['user', 'model']).toContain(turn.role);
        expect(Array.isArray(turn.parts)).toBe(true);
        expect(turn.parts?.[0]?.text?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  test('unknown vibe falls back to genz', () => {
    expect(getVoiceBundle('unknown' as Vibe)).toBe(getVoiceBundle('genz'));
    expect(getVoiceBundle(undefined)).toBe(getVoiceBundle('genz'));
    expect(getVoiceBundle(null)).toBe(getVoiceBundle('genz'));
  });

  test('bundle references are stable across calls — required for Gemini prefix cache', () => {
    // The whole point of building prefillContents once at module load
    // is that Gemini's implicit prefix cache hits on a *reference*
    // match. If a refactor accidentally rebuilds per-call, this test
    // catches it before cost spikes 3× in prod.
    expect(getVoiceBundle('genz').prefillContents).toBe(getVoiceBundle('genz').prefillContents);
    expect(getVoiceBundle('chill').prefillContents).toBe(getVoiceBundle('chill').prefillContents);
    expect(getVoiceBundle('professional').prefillContents).toBe(
      getVoiceBundle('professional').prefillContents,
    );
  });

  test('genz keeps the original lowercase + dark-humor markers', () => {
    const { voiceRules } = getVoiceBundle('genz');
    expect(voiceRules).toMatch(/Gen-Z/);
    expect(voiceRules).toMatch(/Lowercase starts/);
    expect(voiceRules).toMatch(/💀/);
  });

  test('chill removes slang and profanity, keeps casual register', () => {
    const { voiceRules } = getVoiceBundle('chill');
    // Has to call out NO slang explicitly.
    expect(voiceRules).toMatch(/NO slang/i);
    expect(voiceRules).toMatch(/NO profanity/i);
  });

  test('professional bans slang, emojis, dark humor', () => {
    const { voiceRules } = getVoiceBundle('professional');
    expect(voiceRules).toMatch(/No profanity/i);
    expect(voiceRules).toMatch(/No emojis/i);
    expect(voiceRules).toMatch(/No dark humor/i);
    expect(voiceRules).toMatch(/Complete sentences/i);
  });

  test('professional prefill has no 💀 / 🙏 emoji and no Gen-Z slang', () => {
    const { prefillContents } = getVoiceBundle('professional');
    const allModelText = prefillContents
      .filter((c) => c.role === 'model')
      .map((c) => c.parts?.[0]?.text ?? '')
      .join('\n');
    expect(allModelText).not.toMatch(/💀|🙏/);
    expect(allModelText).not.toMatch(/\b(bestie|lock in|lowkey|no cap|bet|fr|ngl|vibing|yo+)\b/i);
  });

  test('chill prefill has no profanity and no genz-specific slang', () => {
    const { prefillContents } = getVoiceBundle('chill');
    const allModelText = prefillContents
      .filter((c) => c.role === 'model')
      .map((c) => c.parts?.[0]?.text ?? '')
      .join('\n');
    expect(allModelText).not.toMatch(/\b(damn|hell|shit|fuck)\b/i);
    expect(allModelText).not.toMatch(/\b(bestie|lock in|lowkey|no cap|bet\.|fr|ngl)\b/i);
  });
});

describe('composeSystemPrompt', () => {
  test('combines voice rules with scope rules in order', () => {
    const scope = 'SCOPE TEST — pull from these notes only.';
    const composed = composeSystemPrompt(scope, 'genz');
    const voiceIdx = composed.indexOf('Wiscord mate');
    const scopeIdx = composed.indexOf(scope);
    expect(voiceIdx).toBeGreaterThanOrEqual(0);
    expect(scopeIdx).toBeGreaterThan(voiceIdx);
  });

  test('different vibes produce different prompts for the same scope', () => {
    const scope = 'SCOPE TEST.';
    const a = composeSystemPrompt(scope, 'genz');
    const b = composeSystemPrompt(scope, 'professional');
    expect(a).not.toBe(b);
    // Both should still include the same scope rules block.
    expect(a).toContain(scope);
    expect(b).toContain(scope);
  });

  test('falls back to genz when vibe is missing or unknown', () => {
    const scope = 'SCOPE.';
    const fallback = composeSystemPrompt(scope, undefined);
    const genz = composeSystemPrompt(scope, 'genz');
    expect(fallback).toBe(genz);
  });
});
