import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login form by default', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Sign in to your account')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('can toggle to signup form', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Create one').click();

    await expect(page.getByText('Create your account')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('can toggle back to login form', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Create one').click();
    await page.getByText('Sign in').click();

    await expect(page.getByText('Sign in to your account')).toBeVisible();
    await expect(page.locator('input[type="text"]')).not.toBeVisible();
  });

  test('signup creates account and redirects', async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'password123';
    const name = 'E2E User';

    await page.goto('/login');
    await page.getByText('Create one').click();

    await page.locator('input[type="text"]').fill(name);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 });
  });

  test('login with valid credentials works', async ({ page }) => {
    const email = `e2e-login-${Date.now()}@example.com`;
    const password = 'password123';

    await page.goto('/login');
    await page.getByText('Create one').click();
    await page.locator('input[type="text"]').fill('Login Test');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 15000 });

    await page.context().clearCookies();
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 });
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[type="email"]').fill('nonexistent@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/error|failed|invalid/i)).toBeVisible({ timeout: 5000 });
  });

  test('missing email shows validation error', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('input[type="email"]')).toBeFocused();
  });
});
