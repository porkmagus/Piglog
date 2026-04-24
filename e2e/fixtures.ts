import { test as base, expect } from '@playwright/test';

export async function signupAndOnboard(page: any) {
  await page.goto('/login');
  await page.getByText('Create one').click();
  await page.locator('input[type="text"]').fill('E2E User');
  await page.locator('input[type="email"]').fill(`e2e-${Date.now()}@example.com`);
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15000 });
}

export const test = base.extend<{ loginAsUser: () => Promise<void> }>({
  loginAsUser: async ({ page }, use) => {
    await use(async () => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
      // Ensure workspace context is loaded by waiting for dashboard content
      await expect(page.locator('main')).not.toHaveText('Loading', { timeout: 15000 });
    });
  },
});

export { expect } from '@playwright/test';
