import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('shows hero section with headline and CTA', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Log aggregation for')).toBeVisible();
    await expect(page.getByText('hackers', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start logging free' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View on GitHub' })).toBeVisible();
  });

  test('nav has sign in and get started links', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible();

    const signInLinks = page.getByRole('link', { name: 'Sign in' });
    await expect(signInLinks.first()).toHaveAttribute('href', '/login');
  });

  test('shows ingestion methods section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Ingest from anywhere')).toBeVisible();
    await expect(page.getByText('HTTP API')).toBeVisible();
    await expect(page.getByText('Syslog', { exact: true })).toBeVisible();
    await expect(page.getByText('File Upload', { exact: true })).toBeVisible();
  });

  test('shows feature cards', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Live Tail')).toBeVisible();
    await expect(page.getByText('Token Search')).toBeVisible();
    await expect(page.getByText('Alert Rules')).toBeVisible();
    await expect(page.getByText('TimescaleDB Hypertables')).toBeVisible();
    await expect(page.getByText('Continuous Aggregates')).toBeVisible();
    await expect(page.getByText('Workspace Isolation')).toBeVisible();
  });

  test('shows code snippet section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Ingest in seconds')).toBeVisible();
    await expect(page.getByText('curl')).toBeVisible();
  });

  test('footer has branding', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('contentinfo').getByText('Piglog')).toBeVisible();
  });

  test('get started link navigates to login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Get started' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
