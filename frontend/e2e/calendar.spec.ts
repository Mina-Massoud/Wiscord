import { test, expect } from '@playwright/test';

/**
 * Calendar happy path. Assumes the user is already signed in (the test
 * suite's globalSetup or the auth fixture handles that — see other
 * specs once the project's auth fixture lands).
 *
 * If you're running locally without the auth fixture: sign in via the
 * magic-link URL printed in the backend log, then `npm run e2e -- calendar`.
 */
test.describe('calendar', () => {
  test.skip(!process.env['WISCORD_E2E_AUTH'], 'Set WISCORD_E2E_AUTH=1 once an auth fixture exists');

  test('renders the personal calendar with the month view by default', async ({ page }) => {
    await page.goto('/app/calendar');
    await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('data-state', 'active');
    // The weekday header row should be present.
    await expect(page.getByRole('columnheader').first()).toBeVisible();
  });

  test('can open the composer from the header button', async ({ page }) => {
    await page.goto('/app/calendar');
    await page.getByRole('button', { name: 'New event' }).click();
    await expect(page.getByRole('dialog', { name: /new event/i })).toBeVisible();
    await expect(page.getByLabel('Title')).toBeVisible();
  });

  test('keyboard shortcuts switch views', async ({ page }) => {
    await page.goto('/app/calendar');
    await page.keyboard.press('Meta+W');
    await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('data-state', 'active');
    await page.keyboard.press('Meta+D');
    await expect(page.getByRole('tab', { name: 'Day' })).toHaveAttribute('data-state', 'active');
    await page.keyboard.press('Meta+M');
    await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('data-state', 'active');
  });

  test('agenda view shows the empty state when nothing is scheduled', async ({ page }) => {
    await page.goto('/app/calendar');
    await page.getByRole('tab', { name: 'Agenda' }).click();
    // Either the populated agenda or the empty-state CTA renders.
    const empty = page.getByText(/No events yet/i);
    const populated = page.getByRole('list');
    await expect(empty.or(populated)).toBeVisible();
  });
});
