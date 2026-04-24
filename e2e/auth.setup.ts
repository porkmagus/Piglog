import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const authFile = resolve('e2e/.auth/user.json');
const API_BASE = 'http://localhost:3001';
const ORIGIN = 'http://localhost:5173';

setup('authenticate', async ({ page }) => {
  const runId = Date.now();
  const email = `pw-auth-${runId}@example.com`;
  const password = 'password123';
  const wsName = `pw-${runId}`;
  const wsSlug = `pw-${runId}`;

  const signupRes = await fetch(`${API_BASE}/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ name: 'Playwright Auth', email, password }),
  });
  if (!signupRes.ok) {
    throw new Error(`Signup failed: ${signupRes.status} ${await signupRes.text()}`);
  }

  const loginRes = await fetch(`${API_BASE}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Missing auth cookie');
  }

  const cookie = setCookie.split(';')[0];
  const wsRes = await fetch(`${API_BASE}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: wsName, slug: wsSlug }),
  });
  if (!wsRes.ok) {
    throw new Error(`Workspace creation failed: ${wsRes.status} ${await wsRes.text()}`);
  }

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

  mkdirSync(dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
