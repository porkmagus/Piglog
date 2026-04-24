import { test, expect } from './fixtures';

test.describe('Global navigation', () => {
  test('sidebar Dashboard link navigates to dashboard', async ({ page }) => {
    await page.goto('/settings/account');
    await page.getByRole('link', { name: 'Account settings' }).click();
    await page.locator('aside').locator('a[href="/dashboard"]').click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('sidebar Streams link navigates to streams', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('aside').locator('a[href="/streams"]').click();
    await page.waitForURL(/\/streams/);
  });

  test('sidebar Settings link navigates to settings', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('aside').locator('a[href="/settings"]').click();
    await page.waitForURL(/\/settings/);
  });

  test('account link navigates to account settings', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('aside a[aria-label="Account settings"]').click();
    await expect(page).toHaveURL(/\/settings\/account/);
  });

  test('can navigate through all settings pages', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('aside a[aria-label="Account settings"]').click();
    await expect(page.getByText('Manage your profile')).toBeVisible();

    await page.getByRole('link', { name: 'Workspace' }).click();
    await expect(page.locator('main').getByRole('heading', { name: 'Workspace' })).toBeVisible();

    await page.getByRole('link', { name: 'Alerts' }).click();
    await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible();
  });
});
