import { test, expect } from '@playwright/test';

test('landing page renders scaffolding complete message', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Wiscord — scaffolding complete')).toBeVisible();
});
