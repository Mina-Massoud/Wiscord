import { render, screen } from '@testing-library/react';
import { MessageCircle } from 'lucide-react';
import { describe, expect, test } from 'vitest';

import { SubscriptionPanelUsageRow } from './SubscriptionPanelUsageRow';

/**
 * Tests pin the load-bearing UX guarantees from the audit:
 *   - Used/cap is rendered as text AND as a width-driven bar
 *   - At zero remaining, the row visibly switches to a destructive
 *     treatment + reset copy (Closes the "0 left disappears" bug
 *     and makes the limit unmissable)
 *   - Pro user (proCapText: null) suppresses the "Pro: …" helper
 *   - Loading state (used: null) renders skeletons, not "0 / N"
 */
describe('SubscriptionPanelUsageRow', () => {
  test('renders count, percentage, and Pro helper for a normal Free row', () => {
    render(
      <SubscriptionPanelUsageRow
        icon={MessageCircle}
        label="messages"
        used={1}
        cap={2}
        proCapText="500/day"
        resetAt={new Date(Date.now() + 60 * 60 * 1000).toISOString()}
      />,
    );
    expect(screen.getByText('messages')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 today')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText(/Pro:/)).toHaveTextContent('Pro: 500/day');
  });

  test('at-zero state: progressbar at 100, destructive copy with reset hint', () => {
    render(
      <SubscriptionPanelUsageRow
        icon={MessageCircle}
        label="messages"
        used={2}
        cap={2}
        proCapText="500/day"
        resetAt={new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()}
      />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    // Reset copy appears IN ADDITION to the Pro helper, so the
    // user sees both "your bucket is empty" and "Pro gets X" at
    // the same glance.
    expect(screen.getByText(/resets/i)).toBeInTheDocument();
    expect(screen.getByText(/Pro: 500\/day/)).toBeInTheDocument();
  });

  test('Pro user (proCapText: null) does NOT render the helper line', () => {
    render(
      <SubscriptionPanelUsageRow
        icon={MessageCircle}
        label="messages"
        used={42}
        cap={500}
        proCapText={null}
        resetAt={new Date(Date.now() + 60 * 60 * 1000).toISOString()}
      />,
    );
    expect(screen.getByText('42 / 500 today')).toBeInTheDocument();
    // The Pro user is already Pro — re-pitching them with
    // "Pro: 500/day" would be silly redundant copy.
    expect(screen.queryByText(/Pro:/)).not.toBeInTheDocument();
  });

  test('loading state (used: null) renders skeletons, not a misleading 0/N', () => {
    const { container } = render(
      <SubscriptionPanelUsageRow
        icon={MessageCircle}
        label="messages"
        used={null}
        cap={2}
        proCapText="500/day"
        resetAt={null}
      />,
    );
    // The numeric label must NOT appear during loading — if we
    // rendered "0 / 2 today" with no usage data yet, the user
    // would see "fully empty bucket" which is wrong.
    expect(screen.queryByText('0 / 2 today')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    // Skeletons present (the project's Skeleton primitive uses the
    // `animate-pulse` class).
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  test('progress bar fill width is driven by used/cap ratio', () => {
    const { container, rerender } = render(
      <SubscriptionPanelUsageRow
        icon={MessageCircle}
        label="messages"
        used={250}
        cap={500}
        proCapText="500/day"
        resetAt={null}
      />,
    );
    const fill = container.querySelector('[role="progressbar"] > div');
    expect((fill as HTMLElement | null)?.style.width).toBe('50%');

    rerender(
      <SubscriptionPanelUsageRow
        icon={MessageCircle}
        label="messages"
        used={400}
        cap={500}
        proCapText="500/day"
        resetAt={null}
      />,
    );
    const updatedFill = container.querySelector('[role="progressbar"] > div');
    expect((updatedFill as HTMLElement | null)?.style.width).toBe('80%');
  });

  test('used > cap clamps to 100% (handles legacy data drift)', () => {
    render(
      <SubscriptionPanelUsageRow
        icon={MessageCircle}
        label="messages"
        used={999}
        cap={2}
        proCapText="500/day"
        resetAt={new Date(Date.now() + 60 * 60 * 1000).toISOString()}
      />,
    );
    // Progress bar caps at 100, not 49950%. The "exhausted"
    // treatment kicks in (resets copy appears).
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText(/resets/i)).toBeInTheDocument();
  });
});
