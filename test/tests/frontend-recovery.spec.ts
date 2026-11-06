import { test, expect } from '../fixtures';
import { daysFromToday, getLoanItems, insertLoanItem, photo, IMAGES } from '../utils';

test('failed loans request offers retry without showing an empty shelf', async ({ page }) => {
  await insertLoanItem({ mediaType: 'BOOK', title: 'Recovered book', library: 'Sihlcity', dueDate: daysFromToday(3) });
  await page.route('**/api/items', route => route.fulfill({ status: 503, json: { detail: 'Loans unavailable' } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Loans unavailable');
  await expect(page.getByText('No items yet.')).not.toBeVisible();
  await page.unroute('**/api/items');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Recovered book')).toBeVisible();
});

test('rejects a malformed API response instead of rendering corrupt item data', async ({ page }) => {
  await page.route('**/api/items', route => route.fulfill({ json: [{ id: 1, title: 'Malformed item' }] }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show details of "Malformed item"' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});

test('failed status change keeps the dialog usable and can be retried', async ({ page }) => {
  await insertLoanItem({ mediaType: 'BOOK', title: 'Retry status', library: 'Sihlcity', dueDate: daysFromToday(3) });
  await page.goto('/');
  await page.getByRole('button', { name: 'Change status of "Retry status"' }).click();
  await page.route('**/api/items/*/status', route => route.fulfill({ status: 503, json: { detail: 'Try saving again' } }));
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('option', { name: 'Read', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Try saving again');
  expect((await getLoanItems())[0].status).toBe('LOANED');
  await page.unroute('**/api/items/*/status');
  await dialog.getByRole('option', { name: 'Read', exact: true }).click();
  await expect(dialog.getByRole('option', { name: 'Read', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('failed upload keeps both photos for retry and clears them only after acceptance', async ({ page }) => {
  await page.goto('/import');
  // Ensure the API has issued the host-only CSRF cookie before uploading.
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
  await page.getByRole('option', { name: 'My own' }).click();
  await page.getByLabel('Front photo').setInputFiles(photo('front.png', IMAGES.bookFront));
  await page.getByLabel('Back photo').setInputFiles(photo('back.png', IMAGES.generatedCover));
  await page.route('**/api/items/import', route => route.fulfill({ status: 503, json: { detail: 'Upload unavailable' } }));
  await page.getByRole('button', { name: 'Import item', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Upload unavailable');
  await expect(page.getByAltText('Front photo preview')).toBeVisible();
  await expect(page.getByAltText('Back photo preview')).toBeVisible();
  await page.unroute('**/api/items/import');
  await page.getByRole('button', { name: 'Import item', exact: true }).click();
  await expect(page.getByAltText('Front photo preview')).not.toBeVisible();
  await expect(page.getByRole('option', { name: 'My own' })).toHaveAttribute('aria-selected', 'true');
});

test('mobile layout supports keyboard filters and restores focus after a dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await insertLoanItem({ mediaType: 'BOOK', title: 'Keyboard book', library: 'Sihlcity', dueDate: daysFromToday(3) });
  await insertLoanItem({ mediaType: 'CD', title: 'Keyboard CD', library: 'Sihlcity', dueDate: daysFromToday(3) });
  await page.goto('/');
  const books = page.getByRole('listbox', { name: 'Filter by type' }).getByRole('option', { name: 'Book', exact: true });
  await books.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(page.getByText('Keyboard book')).not.toBeVisible();
  const trigger = page.getByRole('button', { name: 'Show details of "Keyboard CD"' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
