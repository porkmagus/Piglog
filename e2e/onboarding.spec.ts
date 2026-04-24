import { test, expect, signupAndOnboard } from './fixtures';

const API_BASE = 'http://localhost:3001';
const ORIGIN = 'http://localhost:5173';

test.describe('Onboarding', () => {
  async function signupForOnboarding(page: Parameters<typeof test>[0]['page']) {
    await page.goto('/login');
    await page.getByText('Create one').click();
    await page.locator('input[type="text"]').fill('E2E User');
    await page.locator('input[type="email"]').fill(`e2e-onboard-${Date.now()}@example.com`);
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Create account' }).click();
  }

  test('shows step 1 workspace creation form', async ({ page }) => {
    await signupForOnboarding(page);
    await page.waitForURL(/\/onboarding/, { timeout: 15000 });

    await expect(page.getByText("Let's set up your workspace.")).toBeVisible();
    await expect(page.getByPlaceholder('My Team')).toBeVisible();
    await expect(page.getByPlaceholder('my-team')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Workspace' })).toBeVisible();
  });

  test('auto-generates slug from workspace name', async ({ page }) => {
    await signupForOnboarding(page);
    await page.waitForURL(/\/onboarding/, { timeout: 15000 });

    await page.getByPlaceholder('My Team').fill('My Test Workspace');
    const slugValue = await page.getByPlaceholder('my-team').inputValue();
    expect(slugValue).toBe('my-test-workspace');
  });

  test('completes full 3-step onboarding flow', async ({ page }) => {
    await signupAndOnboard(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('skips onboarding if workspace already exists', async ({ page }) => {
    const runId = Date.now();
    const email = `e2e-skip-${runId}@example.com`;
    const password = 'password123';

    const signupRes = await fetch(`${API_BASE}/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ name: 'E2E User', email, password }),
    });
    expect(signupRes.ok).toBeTruthy();

    const loginRes = await fetch(`${API_BASE}/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.ok).toBeTruthy();

    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
    expect(cookie).toBeTruthy();

    const wsRes = await fetch(`${API_BASE}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie! },
      body: JSON.stringify({ name: `ws-${runId}`, slug: `ws-${runId}` }),
    });
    expect(wsRes.ok).toBeTruthy();

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
