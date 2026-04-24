import { test, expect } from './fixtures';

test.describe('Settings navigation', () => {
  test('settings sidebar has all nav items', async ({ page }) => {
    await page.goto('/settings/workspace');

    const settingsAside = page.locator('aside').nth(1);
    await expect(settingsAside.getByRole('link', { name: 'Workspace' })).toBeVisible();
    await expect(settingsAside.getByRole('link', { name: 'Alerts' })).toBeVisible();
  });

  test('Account page shows email and logout', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('aside a[aria-label="Account settings"]').click();

    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    await expect(page.getByText('Manage your profile')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  });

  test('Workspace settings page loads', async ({ page }) => {
    await page.goto('/settings/workspace');
    await expect(page.locator('main').getByRole('heading', { name: 'Workspace' })).toBeVisible();
  });

  test('Ingestion page shows sources and integrations sections', async ({ page }) => {
    await page.goto('/settings/ingestion');

    await expect(page.getByRole('heading', { name: 'Ingestion' })).toBeVisible();
    await expect(page.getByText('Sources are systems that send logs to Piglog')).toBeVisible();
    await expect(page.getByText('Integrations are services Piglog connects to')).toBeVisible();
  });

  test('Ingestion page has Add Source link', async ({ page }) => {
    await page.goto('/settings/ingestion');
    await expect(page.getByRole('link', { name: 'Add Source' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add Source' })).toHaveAttribute('href', '/settings/sources');
  });

  test('Ingestion page has Add Integration link', async ({ page }) => {
    await page.goto('/settings/ingestion');
    await expect(page.getByRole('link', { name: 'Add Integration' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add Integration' })).toHaveAttribute('href', '/settings/integrations');
  });

  test('Settings heading is visible in sidebar', async ({ page }) => {
    await page.goto('/settings/account');
    await expect(page.locator('aside').nth(1).getByText('Settings', { exact: true })).toBeVisible();
  });
});
