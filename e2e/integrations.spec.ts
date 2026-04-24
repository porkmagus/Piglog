import { test, expect } from './fixtures';

test.describe('Integrations', () => {
  test.beforeEach(async ({ loginAsUser }) => {
    await loginAsUser();
  });

  test('shows integrations page header', async ({ page }) => {
    await page.goto('/settings/integrations');

    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    await expect(main.getByText('connects to external services')).toBeVisible();
  });

  test('shows NextDNS connect section', async ({ page }) => {
    await page.goto('/settings/integrations');

    await expect(page.locator('main').getByText('Connect NextDNS')).toBeVisible();
  });

  test('NextDNS form has name and API key fields', async ({ page }) => {
    await page.goto('/settings/integrations');

    const main = page.locator('main');
    await expect(main.locator('input[placeholder="e.g. My NextDNS"]')).toBeVisible();
    await expect(main.locator('input[placeholder="Enter your NextDNS API key"]')).toBeVisible();
  });

  test('NextDNS form has Test Connection button', async ({ page }) => {
    await page.goto('/settings/integrations');

    await expect(page.locator('main').getByRole('button', { name: 'Discover Profiles' })).toBeVisible();
  });

  test('test connection with invalid key shows error', async ({ page }) => {
    await page.goto('/settings/integrations');

    const main = page.locator('main');
    await main.locator('input[placeholder="e.g. My NextDNS"]').fill('test');
    await main.locator('input[placeholder="Enter your NextDNS API key"]').fill('invalid-key-123');
    await main.getByRole('button', { name: 'Discover Profiles' }).click();

    await expect(main.getByText(/error|invalid|unauthorized|failed|Discovery failed/i)).toBeVisible({ timeout: 10000 });
  });
});
