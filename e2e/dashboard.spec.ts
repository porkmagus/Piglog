import { test, expect } from './fixtures';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ loginAsUser }) => {
    await loginAsUser();
  });

  test('shows dashboard title', async ({ page }) => {
    await expect(page.locator('main').getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('sidebar has all main navigation links', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/streams"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/settings"]')).toBeVisible();
  });

  test('shows dashboard with edit button and default widgets', async ({ page }) => {
    const mainContent = page.locator('main');
    await expect(mainContent.getByRole('button', { name: /edit dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(mainContent.getByRole('heading', { name: 'Log Volume' })).toBeVisible({ timeout: 10000 });
  });

  test('edit dashboard button enters edit mode', async ({ page }) => {
    const main = page.locator('main');
    await main.getByRole('button', { name: /edit dashboard/i }).click();
    await expect(main.getByText('+ Add Widget')).toBeVisible();
  });

  test('add widget modal lists available widgets', async ({ page }) => {
    const main = page.locator('main');
    await main.getByRole('button', { name: /edit dashboard/i }).click();
    await main.getByText('+ Add Widget').click();
    await expect(page.getByRole('button', { name: 'Log Volume Logs ingested per hour', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Level Breakdown Logs by severity level', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Custom Query Run your own SQL query', exact: true })).toBeVisible();
  });

  test('account link is visible in sidebar footer', async ({ page }) => {
    const accountLink = page.getByRole('link', { name: 'Account settings' });
    await expect(accountLink).toBeVisible();
    await expect(accountLink).toHaveAttribute('href', '/settings/account');
  });

  test('Piglog branding is visible', async ({ page }) => {
    await expect(page.locator('aside').getByText('Piglog')).toBeVisible();
  });
});
