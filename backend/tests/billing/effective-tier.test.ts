import { describe, expect, test } from 'vitest';

import { resolveEffectiveTier } from '../../src/modules/billing/effective-tier.js';

/**
 * H5 — the "Pro until period end" grace window after a user cancels.
 *
 * Why these cases matter: the webhook keeps `subscriptionTier='pro'`
 * on the user doc during the grace window but flips it to `'free'`
 * once the period lapses. The actual tier-resolution decision lives
 * in `resolveEffectiveTier`, which consults `subscriptionStatus` and
 * `currentPeriodEnd` directly. So even if the denormalized
 * `subscriptionTier` field drifts (e.g. a webhook is delayed), the
 * effective tier returned to the AI module stays correct.
 */
describe('resolveEffectiveTier', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000); // +1 day
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000); // -1 day

  test('null / undefined billing → free', () => {
    expect(resolveEffectiveTier(null)).toBe('free');
    expect(resolveEffectiveTier(undefined)).toBe('free');
    expect(resolveEffectiveTier({})).toBe('free');
  });

  test('active → pro', () => {
    expect(
      resolveEffectiveTier({ subscriptionStatus: 'active', subscriptionTier: 'pro' }),
    ).toBe('pro');
  });

  test('trialing → pro', () => {
    expect(
      resolveEffectiveTier({ subscriptionStatus: 'trialing', subscriptionTier: 'pro' }),
    ).toBe('pro');
  });

  test('past_due → pro (Smart Retries grace window)', () => {
    expect(
      resolveEffectiveTier({ subscriptionStatus: 'past_due', subscriptionTier: 'pro' }),
    ).toBe('pro');
  });

  test('canceled WITH currentPeriodEnd in the future → pro (paid grace)', () => {
    expect(
      resolveEffectiveTier({
        subscriptionStatus: 'canceled',
        subscriptionTier: 'free',
        currentPeriodEnd: future,
      }),
    ).toBe('pro');
  });

  test('canceled WITH currentPeriodEnd in the past → free', () => {
    expect(
      resolveEffectiveTier({
        subscriptionStatus: 'canceled',
        subscriptionTier: 'free',
        currentPeriodEnd: past,
      }),
    ).toBe('free');
  });

  test('canceled WITH null currentPeriodEnd → free', () => {
    expect(
      resolveEffectiveTier({ subscriptionStatus: 'canceled', currentPeriodEnd: null }),
    ).toBe('free');
  });

  test('canceled WITHOUT currentPeriodEnd field → free', () => {
    expect(resolveEffectiveTier({ subscriptionStatus: 'canceled' })).toBe('free');
  });

  test('unpaid → free (Smart Retries exhausted, no grace)', () => {
    expect(
      resolveEffectiveTier({ subscriptionStatus: 'unpaid', currentPeriodEnd: future }),
    ).toBe('free');
  });

  test('paused → free', () => {
    expect(
      resolveEffectiveTier({ subscriptionStatus: 'paused', currentPeriodEnd: future }),
    ).toBe('free');
  });

  test('none → free', () => {
    expect(resolveEffectiveTier({ subscriptionStatus: 'none' })).toBe('free');
  });

  test('accepts currentPeriodEnd as ISO string (Mongoose lean output shape)', () => {
    expect(
      resolveEffectiveTier({
        subscriptionStatus: 'canceled',
        currentPeriodEnd: future.toISOString(),
      }),
    ).toBe('pro');
    expect(
      resolveEffectiveTier({
        subscriptionStatus: 'canceled',
        currentPeriodEnd: past.toISOString(),
      }),
    ).toBe('free');
  });

  test('honors the `now` override (clock-independent unit test)', () => {
    const anchor = new Date('2026-06-01T00:00:00Z');
    const tenDaysAfterAnchor = new Date('2026-06-11T00:00:00Z');
    // currentPeriodEnd 10 days AFTER the anchor → grace still active
    expect(
      resolveEffectiveTier(
        { subscriptionStatus: 'canceled', currentPeriodEnd: tenDaysAfterAnchor },
        anchor,
      ),
    ).toBe('pro');
    // Move the clock 11 days past the anchor → grace lapsed
    const tenDaysOneSec = new Date('2026-06-11T00:00:01Z');
    expect(
      resolveEffectiveTier(
        { subscriptionStatus: 'canceled', currentPeriodEnd: tenDaysAfterAnchor },
        tenDaysOneSec,
      ),
    ).toBe('free');
  });

  test('boundary: currentPeriodEnd exactly equal to now → free', () => {
    // The check is `>`, not `>=`, so equality flips to free. Documented
    // here so a future refactor can't silently change the boundary.
    const exact = new Date('2026-06-01T00:00:00Z');
    expect(
      resolveEffectiveTier(
        { subscriptionStatus: 'canceled', currentPeriodEnd: exact },
        exact,
      ),
    ).toBe('free');
  });
});
