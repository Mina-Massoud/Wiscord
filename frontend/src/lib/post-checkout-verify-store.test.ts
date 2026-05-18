import { beforeEach, describe, expect, test } from 'vitest';

import {
  isInVerifyWindow,
  POST_CHECKOUT_VERIFY_BUDGET_MS,
  usePostCheckoutVerify,
} from './post-checkout-verify-store';

beforeEach(() => {
  // Each test starts with the store reset so order doesn't matter.
  usePostCheckoutVerify.setState({ startedAt: null });
});

describe('postCheckoutVerify store', () => {
  test('start() stamps a non-null timestamp', () => {
    expect(usePostCheckoutVerify.getState().startedAt).toBeNull();
    usePostCheckoutVerify.getState().start();
    expect(usePostCheckoutVerify.getState().startedAt).toBeGreaterThan(0);
  });

  test('stop() clears the timestamp', () => {
    usePostCheckoutVerify.getState().start();
    usePostCheckoutVerify.getState().stop();
    expect(usePostCheckoutVerify.getState().startedAt).toBeNull();
  });

  test('start() after stop() emits a fresh timestamp', async () => {
    usePostCheckoutVerify.getState().start();
    const first = usePostCheckoutVerify.getState().startedAt;
    usePostCheckoutVerify.getState().stop();
    await new Promise((r) => setTimeout(r, 2));
    usePostCheckoutVerify.getState().start();
    const second = usePostCheckoutVerify.getState().startedAt;
    expect(second).not.toBe(first);
    expect(second).toBeGreaterThan(first ?? 0);
  });
});

describe('isInVerifyWindow', () => {
  test('null timestamp → not in window', () => {
    expect(isInVerifyWindow(null)).toBe(false);
  });

  test('just started → in window', () => {
    const now = Date.now();
    expect(isInVerifyWindow(now, now + 100)).toBe(true);
  });

  test('within budget → in window', () => {
    const started = 1_000_000;
    const now = started + POST_CHECKOUT_VERIFY_BUDGET_MS - 1;
    expect(isInVerifyWindow(started, now)).toBe(true);
  });

  test('budget exhausted → not in window', () => {
    const started = 1_000_000;
    const now = started + POST_CHECKOUT_VERIFY_BUDGET_MS + 1;
    expect(isInVerifyWindow(started, now)).toBe(false);
  });

  test('exact budget boundary → NOT in window (strict <)', () => {
    // Documented boundary — if a future refactor flips to `<=`, this
    // test catches it. The check is `<` so the budget is exclusive.
    const started = 1_000_000;
    const now = started + POST_CHECKOUT_VERIFY_BUDGET_MS;
    expect(isInVerifyWindow(started, now)).toBe(false);
  });
});
