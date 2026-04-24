import { test, expect } from './fixtures';

test.describe('Streams', () => {
  test.beforeEach(async ({ loginAsUser }) => {
    await loginAsUser();
  });

  test('streams index redirects to default stream', async ({ page }) => {
    await page.goto('/streams');
    await page.waitForURL(/\/streams\/default/);
    await expect(page).toHaveURL(/\/streams\/default/);
  });

  test('default stream page loads', async ({ page }) => {
    await page.goto('/streams/default');
    await expect(page).toHaveURL(/\/streams\/default/);
  });

  test('custom stream ID page loads', async ({ page }) => {
    await page.goto('/streams/custom-stream');
    await expect(page).toHaveURL(/\/streams\/custom-stream/);
  });
});
