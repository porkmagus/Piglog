import { test as base, expect } from '@playwright/test';

export async function signupAndOnboard(page: any) {
  const runId = Date.now();
  await page.goto('/login');
  await page.getByText('Create one').click();
  await page.locator('input[type="text"]').fill('E2E User');
  await page.locator('input[type="email"]').fill(`e2e-${runId}@example.com`);
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 });

  // Complete onboarding step 1: create workspace
  await page.getByPlaceholder('My Team').fill(`ws-${runId}`);
  await page.getByRole('button', { name: 'Create Workspace' }).click();

  // After workspace creation, the app may redirect to dashboard
  // or stay on onboarding step 2. Handle both cases.
  const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
  try {
    await dashboardHeading.waitFor({ state: 'visible', timeout: 5000 });
    return; // Already on dashboard
  } catch {
    // Still on onboarding, continue to step 2
  }

  // Complete onboarding step 2: create source
  await expect(page.getByText('Create your first log source.')).toBeVisible({ timeout: 10000 });
  await page.getByPlaceholder('production-api').fill('e2e-source');
  await page.getByRole('button', { name: 'Create Source' }).click();

  // Complete onboarding step 3: go to dashboard
  await expect(page.getByText("You're ready to start shipping logs")).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
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
