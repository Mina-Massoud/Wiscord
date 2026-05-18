import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Subscription } from '@/queries/billing';

import { SubscriptionPanelAutoRenewRow } from './SubscriptionPanelAutoRenewRow';

/**
 * Tests pin the load-bearing UX guarantees for the auto-renew
 * toggle:
 *   - Row only appears for active|trialing Pro subs (free /
 *     past_due / canceled get nothing here — those have their
 *     own affordances)
 *   - Switch state mirrors the inverse of cancelAtPeriodEnd
 *   - Helper copy reflects the toggle position + period end date
 *   - Toggling fires the mutation
 */

const mocks = vi.hoisted(() => ({
  setAutoRenewMutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/queries/billing', async () => {
  const actual = await vi.importActual<typeof import('@/queries/billing')>('@/queries/billing');
  return {
    ...actual,
    useSetAutoRenew: () => ({ mutate: mocks.setAutoRenewMutate, isPending: false }),
  };
});

vi.mock('@/lib/toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: vi.fn(),
    loading: vi.fn(),
  },
}));

const PERIOD_END_ISO = '2026-08-12T00:00:00.000Z';

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    status: 'active',
    tier: 'pro',
    currentPeriodEnd: PERIOD_END_ISO,
    hasCustomer: true,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function renderRow(sub: Subscription) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SubscriptionPanelAutoRenewRow sub={sub} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.setAutoRenewMutate.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SubscriptionPanelAutoRenewRow', () => {
  test('hidden for Free users', () => {
    const { container } = renderRow(makeSub({ tier: 'free', status: 'none' }));
    expect(container.firstChild).toBeNull();
  });

  test('hidden for past_due users (StatusBanner owns that flow)', () => {
    const { container } = renderRow(makeSub({ status: 'past_due' }));
    expect(container.firstChild).toBeNull();
  });

  test('hidden for canceled users in grace (StatusBanner owns that flow)', () => {
    const { container } = renderRow(
      makeSub({ status: 'canceled', cancelAtPeriodEnd: false }),
    );
    expect(container.firstChild).toBeNull();
  });

  test('active + cancelAtPeriodEnd false: Switch ON + "Renews on …" helper', () => {
    renderRow(makeSub({ cancelAtPeriodEnd: false }));
    const sw = screen.getByRole('switch', { name: /auto-renew subscription/i });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Renews on/i)).toBeInTheDocument();
  });

  test('active + cancelAtPeriodEnd true: Switch OFF + "Pro ends …" helper', () => {
    renderRow(makeSub({ cancelAtPeriodEnd: true }));
    const sw = screen.getByRole('switch', { name: /auto-renew subscription/i });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Pro ends/i)).toBeInTheDocument();
    // The "Renews on" copy must NOT appear alongside — that was the
    // bug that prompted exposing the toggle in-app.
    expect(screen.queryByText(/Renews on/i)).not.toBeInTheDocument();
  });

  test('trialing users also see the Switch', () => {
    renderRow(makeSub({ status: 'trialing' }));
    expect(
      screen.getByRole('switch', { name: /auto-renew subscription/i }),
    ).toBeInTheDocument();
  });

  test('clicking the Switch fires the mutation with the inverted value', async () => {
    const user = userEvent.setup();
    renderRow(makeSub({ cancelAtPeriodEnd: false }));
    await user.click(screen.getByRole('switch', { name: /auto-renew subscription/i }));
    // Toggling from "renewing" to "not renewing" sends enabled=false
    // (the Switch reflects renewing; the mutation expects enabled).
    expect(mocks.setAutoRenewMutate).toHaveBeenCalledWith(false, expect.any(Object));
  });

  test('clicking when off fires mutation with enabled=true', async () => {
    const user = userEvent.setup();
    renderRow(makeSub({ cancelAtPeriodEnd: true }));
    await user.click(screen.getByRole('switch', { name: /auto-renew subscription/i }));
    expect(mocks.setAutoRenewMutate).toHaveBeenCalledWith(true, expect.any(Object));
  });
});
