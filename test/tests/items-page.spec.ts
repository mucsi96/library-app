import { test, expect } from '../fixtures';
import { daysFromToday, getLoanItems, insertLoanItem } from '../utils';

test('shows empty state with a link to the import page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('No items yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Import your loans' }).click();
  await expect(page.getByRole('heading', { name: 'Import loans' })).toBeVisible();
});

test('lists borrowed items with due date, type and library', async ({ page }) => {
  await insertLoanItem({
    barcode: '30001023264560',
    mediaType: 'BOOK',
    title: 'Kommissar Pfote. - 3. Schnüffel-Einsatz auf dem Schulhof',
    author: 'Kaja Reider',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
    note: 'nicht verlängerbar',
  });
  await insertLoanItem({
    barcode: '30001020102858',
    mediaType: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    author: 'Otfried Preussler',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });

  await page.goto('/');

  await expect(
    page.getByText('Kommissar Pfote. - 3. Schnüffel-Einsatz auf dem Schulhof')
  ).toBeVisible();
  await expect(page.getByText('Kei Angscht vor em Hotzeplotz')).toBeVisible();
  await expect(page.getByText('Due in 12 days').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'CD', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Book', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sihlcity' }).first()).toBeVisible();
  await expect(page.getByText('nicht verlängerbar')).toBeVisible();
});

test('filters items by type and library', async ({ page }) => {
  await insertLoanItem({
    barcode: '30001023264560',
    mediaType: 'BOOK',
    title: 'Kommissar Pfote',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });
  await insertLoanItem({
    barcode: '30001020102858',
    mediaType: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    library: 'Oerlikon',
    dueDate: daysFromToday(12),
  });

  await page.goto('/');

  await expect(page.getByText('Kommissar Pfote')).toBeVisible();
  await expect(page.getByText('Kei Angscht vor em Hotzeplotz')).toBeVisible();

  // Filter by type.
  await page.getByRole('option', { name: 'CD' }).click();
  await expect(page.getByText('Kommissar Pfote')).not.toBeVisible();
  await expect(page.getByText('Kei Angscht vor em Hotzeplotz')).toBeVisible();

  // Clicking again clears the filter.
  await page.getByRole('option', { name: 'CD' }).click();
  await expect(page.getByText('Kommissar Pfote')).toBeVisible();

  // Filter by library.
  await page.getByRole('option', { name: 'Sihlcity' }).click();
  await expect(page.getByText('Kommissar Pfote')).toBeVisible();
  await expect(page.getByText('Kei Angscht vor em Hotzeplotz')).not.toBeVisible();

  // Combining both filters can match nothing.
  await page.getByRole('option', { name: 'CD' }).click();
  await expect(page.getByText('No items match the selected filters.')).toBeVisible();
});

test('highlights overdue items', async ({ page }) => {
  await insertLoanItem({
    barcode: '30001023264560',
    mediaType: 'BOOK',
    title: 'Overdue book',
    library: 'Sihlcity',
    dueDate: daysFromToday(-1),
  });

  await page.goto('/');

  await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
});

test('shows a reminder for items due soon', async ({ page }) => {
  await insertLoanItem({
    barcode: '30001023264560',
    mediaType: 'BOOK',
    title: 'Due soon book',
    library: 'Sihlcity',
    dueDate: daysFromToday(2),
  });

  await page.goto('/');

  await expect(page.getByText('Due in 2 days')).toBeVisible();
});

test('marks a book as read', async ({ page }) => {
  await insertLoanItem({
    barcode: '30001023264560',
    mediaType: 'BOOK',
    title: 'Kommissar Pfote',
    library: 'Sihlcity',
    dueDate: '2099-08-11',
  });

  await page.goto('/');

  const checkbox = page.getByRole('checkbox', {
    name: 'Mark "Kommissar Pfote" as read',
  });
  await checkbox.check();
  await expect(checkbox).toBeChecked();

  // Persisted: still checked after a reload and stored in the database.
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: 'Mark "Kommissar Pfote" as read' })
  ).toBeChecked();
  const items = await getLoanItems();
  expect(items[0].completed).toBe(true);
});

test('marks a CD as listened and can undo it', async ({ page }) => {
  await insertLoanItem({
    barcode: '30001020102858',
    mediaType: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    library: 'Sihlcity',
    dueDate: '2099-08-11',
  });

  await page.goto('/');

  const checkbox = page.getByRole('checkbox', {
    name: 'Mark "Kei Angscht vor em Hotzeplotz" as listened',
  });
  await checkbox.check();
  await expect(checkbox).toBeChecked();

  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();

  await page.reload();
  await expect(
    page.getByRole('checkbox', {
      name: 'Mark "Kei Angscht vor em Hotzeplotz" as listened',
    })
  ).not.toBeChecked();
});
