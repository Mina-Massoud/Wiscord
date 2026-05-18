import { describe, expect, test } from 'vitest';

import { PLANS, quotaFor, strongModelFor } from '../../src/modules/billing/plans.js';
import { QUOTAS } from '../../src/modules/ai/quota.js';

/**
 * H7 — plans registry. These tests pin the shape of the registry
 * so a future change that drops a tier or a quota kind is caught
 * before it ships. They also confirm the back-compat `QUOTAS`
 * export in `ai/quota.ts` is identity-equal to the registry caps,
 * so anyone still reading from the old export gets the same
 * numbers as anyone calling `quotaFor()` directly.
 */
describe('plans registry', () => {
  test('every tier defines both quota kinds', () => {
    for (const planId of Object.keys(PLANS) as Array<keyof typeof PLANS>) {
      const plan = PLANS[planId];
      expect(plan.quotas.message).toBeGreaterThan(0);
      expect(plan.quotas.url_note).toBeGreaterThan(0);
    }
  });

  test('pro caps are strictly higher than free for both kinds', () => {
    expect(PLANS.pro.quotas.message).toBeGreaterThan(PLANS.free.quotas.message);
    expect(PLANS.pro.quotas.url_note).toBeGreaterThan(PLANS.free.quotas.url_note);
  });

  test('only pro gets a strong model assignment (free → null)', () => {
    expect(strongModelFor('free')).toBeNull();
    expect(strongModelFor('pro')).toBe('gemini-2.5-flash');
  });

  test('quotaFor returns the registry numbers', () => {
    expect(quotaFor('free', 'message')).toBe(PLANS.free.quotas.message);
    expect(quotaFor('pro', 'url_note')).toBe(PLANS.pro.quotas.url_note);
  });

  test('back-compat: ai/quota.QUOTAS mirrors PLANS quotas', () => {
    // Existing callers (admin metrics, tests) still read from
    // `QUOTAS`. This test pins the equivalence so a future change
    // to PLANS automatically flows through, or any drift is caught.
    expect(QUOTAS.free).toEqual(PLANS.free.quotas);
    expect(QUOTAS.pro).toEqual(PLANS.pro.quotas);
  });
});
