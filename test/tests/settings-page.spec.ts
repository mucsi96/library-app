import { test, expect } from '../fixtures';
import { insertLibrary, query } from '../utils';

test('manages the library list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();

  await expect(page.getByRole('heading', { name: 'Libraries' })).toBeVisible();
  await expect(page.getByText('No libraries yet.')).toBeVisible();

  await page.getByLabel('Library name').fill('Sihlcity');
  await page.getByRole('button', { name: 'Add library' }).click();
  await expect(page.getByText('Sihlcity')).toBeVisible();

  await page.getByLabel('Library name').fill('Oerlikon');
  await page.getByRole('button', { name: 'Add library' }).click();
  await expect(page.getByText('Oerlikon')).toBeVisible();

  // The id is a slug of the name, not a number.
  const rows = await query('SELECT id, name FROM library.libraries ORDER BY id');
  expect(rows.rows).toEqual([
    { id: 'oerlikon', name: 'Oerlikon' },
    { id: 'sihlcity', name: 'Sihlcity' },
  ]);

  await page.getByRole('button', { name: 'Remove Sihlcity' }).click();
  await expect(page.getByText('Sihlcity')).not.toBeVisible();
  await expect(page.getByText('Oerlikon')).toBeVisible();
});

test('rejects a duplicate library name', async ({ page }) => {
  await insertLibrary('Sihlcity');

  await page.goto('/settings');

  await page.getByLabel('Library name').fill('Sihlcity');
  await page.getByRole('button', { name: 'Add library' }).click();

  await expect(page.getByRole('alert')).toContainText('already exists');
});

test('import page offers the managed libraries and My own', async ({
  page,
}) => {
  await insertLibrary('Sihlcity');
  await insertLibrary('Oerlikon');

  await page.goto('/import');

  await expect(page.getByRole('option', { name: 'Sihlcity' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Oerlikon' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'My own' })).toBeVisible();
});
