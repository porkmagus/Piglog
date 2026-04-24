import { test, expect, signupAndOnboard } from './fixtures';

test.describe('Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await signupAndOnboard(page);
  });

  test('shows alerts page header', async ({ page }) => {
    await page.goto('/settings/alerts');
    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: 'Alerts' })).toBeVisible();
    await expect(main.getByText('Monitor your logs for anomalies')).toBeVisible();
  });

  test('shows Rules tab by default', async ({ page }) => {
    await page.goto('/settings/alerts');
    const main = page.locator('main');
    await expect(main.getByRole('button', { name: 'Rules' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'History' })).toBeVisible();
  });

  test('shows New Rule button on Rules tab', async ({ page }) => {
    await page.goto('/settings/alerts');
    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: 'Alerts' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'New Rule' })).toBeVisible();
  });

  test('can open and close create rule form', async ({ page }) => {
    await page.goto('/settings/alerts');
    const main = page.locator('main');
    await expect(main.getByRole('button', { name: 'New Rule' })).toBeVisible();
    await main.getByRole('button', { name: 'New Rule' }).click();
    await expect(main.getByPlaceholder('e.g. High error rate')).toBeVisible();
    await expect(main.getByPlaceholder('e.g. api')).toBeVisible();
    await expect(main.getByPlaceholder('https://hooks.slack.com/...')).toBeVisible();
    await main.getByRole('button', { name: 'Cancel' }).click();
    await expect(main.getByPlaceholder('e.g. High error rate')).not.toBeVisible({ timeout: 5000 });
  });

  test('can create an alert rule', async ({ page }) => {
    await page.goto('/settings/alerts');
    const main = page.locator('main');
    await main.getByRole('button', { name: 'New Rule' }).click();
    await main.getByPlaceholder('e.g. High error rate').fill(`e2e-alert-${Date.now()}`);
    await main.getByPlaceholder('e.g. api').fill('test-service');
    await main.locator('input[type="number"]').nth(0).fill('5');
    await main.getByRole('button', { name: 'Create Rule' }).click();
    await expect(main.getByPlaceholder('e.g. High error rate')).not.toBeVisible({ timeout: 5000 });
  });

  test('can switch to History tab', async ({ page }) => {
    await page.goto('/settings/alerts');
    const main = page.locator('main');
    await main.getByRole('button', { name: 'History' }).click();
    await expect(main.getByText('No alert events yet.')).toBeVisible({ timeout: 10000 });
  });

  test('operator dropdown has options', async ({ page }) => {
    await page.goto('/settings/alerts');
    const main = page.locator('main');
    await main.getByRole('button', { name: 'New Rule' }).click();
    const operatorSelect = main.locator('select').nth(1);
    await operatorSelect.selectOption({ label: 'Greater than' });
    await operatorSelect.selectOption({ label: 'Less than' });
    await operatorSelect.selectOption({ label: 'Equals' });
  });

  test('level dropdown has options', async ({ page }) => {
    await page.goto('/settings/alerts');
    const main = page.locator('main');
    await main.getByRole('button', { name: 'New Rule' }).click();
    const levelSelect = main.locator('select').nth(0);
    await levelSelect.selectOption({ label: 'Any' });
    await levelSelect.selectOption({ label: 'DEBUG' });
    await levelSelect.selectOption({ label: 'INFO' });
    await levelSelect.selectOption({ label: 'ERROR' });
  });
});
