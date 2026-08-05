import { test, expect } from '../fixtures';

test('displays app title in browser tab', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('My loans');
});

test('displays app title in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Library App' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Library App' })).toHaveAttribute('href', '/');
});

test('shows user initials in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
});

test('shows user name in popup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'TU' }).click();
  await expect(page.getByText('Test User')).toBeVisible();
});
