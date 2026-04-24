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

  test('shows empty state with quick actions when no logs', async ({ page }) => {
    const mainContent = page.locator('main');
    await expect(mainContent.getByText('Add Source')).toBeVisible({ timeout: 10000 });
    await expect(mainContent.getByText('Add Integration')).toBeVisible({ timeout: 10000 });
  });

  test('Add Source button navigates to sources page', async ({ page }) => {
    const main = page.locator('main');
    await main.getByText('Add Source').click();
    await expect(page).toHaveURL(/\/settings\/sources/);
  });

  test('Add Integration button navigates to integrations page', async ({ page }) => {
    const main = page.locator('main');
    await main.getByText('Add Integration').click();
    await expect(page).toHaveURL(/\/settings\/integrations/);
  });

  test('workspace switcher is visible', async ({ page }) => {
    const workspaceSwitcher = page.locator('button[aria-label="Workspace switcher"]');
    await expect(workspaceSwitcher).toBeVisible();
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
