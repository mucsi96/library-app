import { test, expect } from '../fixtures';
import {
  IMAGES,
  daysFromToday,
  getLoanItems,
  insertLoanItem,
  writeThumbnail,
} from '../utils';

test('shows empty state with a link to the import page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('No items yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Import an item' }).click();
  await expect(page.getByRole('heading', { name: 'Import item' })).toBeVisible();
});

test('lists borrowed items with due date, type and library', async ({ page }) => {
  await insertLoanItem({
    isbn: '9783751300810',
    mediaType: 'BOOK',
    title: 'Kommissar Pfote. - 3. Schnüffel-Einsatz auf dem Schulhof',
    author: 'Kaja Reider',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });
  await insertLoanItem({
    isbn: '9784257178293',
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
});

test('shows cover thumbnails with a placeholder for items without one', async ({
  page,
}) => {
  await insertLoanItem({
    isbn: '9783440153598',
    mediaType: 'BOOK',
    title: 'Die drei ??? Kids - Diebe im Tierpark',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });
  writeThumbnail('9783440153598', Buffer.from(IMAGES.generatedCover, 'base64'));
  await insertLoanItem({
    mediaType: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });

  await page.goto('/');

  await expect(
    page.getByRole('img', {
      name: 'Cover of "Die drei ??? Kids - Diebe im Tierpark"',
    })
  ).toBeVisible();
  // The CD without an ISBN gets no cover image, only a placeholder.
  await expect(
    page.getByRole('img', { name: 'Cover of "Kei Angscht vor em Hotzeplotz"' })
  ).not.toBeVisible();
});

test('filters items by type and library', async ({ page }) => {
  await insertLoanItem({
    isbn: '9783751300810',
    mediaType: 'BOOK',
    title: 'Kommissar Pfote',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });
  await insertLoanItem({
    isbn: '9784257178293',
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

test('lists own items without a due date and filters them', async ({
  page,
}) => {
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'My own book',
    status: 'READING',
  });
  await insertLoanItem({
    isbn: '9783751300810',
    mediaType: 'BOOK',
    title: 'Borrowed book',
    library: 'Sihlcity',
    dueDate: daysFromToday(5),
  });

  await page.goto('/');

  const ownRow = page.getByRole('row').filter({ hasText: 'My own book' });
  await expect(ownRow.getByRole('cell', { name: 'My own' })).toBeVisible();
  await expect(ownRow.getByText(/Due|Overdue/)).not.toBeVisible();

  // Own items have their own filter chip next to the libraries.
  await page.getByRole('option', { name: 'My own' }).click();
  await expect(page.getByText('Borrowed book')).not.toBeVisible();
  await expect(page.getByText('My own book')).toBeVisible();
});

test('highlights overdue items', async ({ page }) => {
  await insertLoanItem({
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
    mediaType: 'BOOK',
    title: 'Due soon book',
    library: 'Sihlcity',
    dueDate: daysFromToday(2),
  });

  await page.goto('/');

  await expect(page.getByText('Due in 2 days')).toBeVisible();
});

test('shows item details in a modal', async ({ page }) => {
  await insertLoanItem({
    isbn: '9783440153598',
    mediaType: 'BOOK',
    title: 'Die drei ??? Kids - Diebe im Tierpark',
    author: 'Anne Scheller',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });
  writeThumbnail('9783440153598', Buffer.from(IMAGES.generatedCover, 'base64'));

  await page.goto('/');
  await page
    .getByRole('button', {
      name: 'Show details of "Die drei ??? Kids - Diebe im Tierpark"',
    })
    .click();

  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Die drei ??? Kids - Diebe im Tierpark' })
  ).toBeVisible();
  await expect(dialog.getByText('9783440153598')).toBeVisible();
  await expect(dialog.getByText('Anne Scheller')).toBeVisible();
  await expect(
    dialog.getByRole('img', {
      name: 'Cover of "Die drei ??? Kids - Diebe im Tierpark"',
    })
  ).toBeVisible();
  for (const status of [
    'Loaned',
    'Reading',
    'Read',
    'Read & returned',
    'Returned unread',
  ]) {
    await expect(
      dialog.getByRole('option', { name: status, exact: true })
    ).toBeVisible();
  }

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible();
});

test('changes a book status to read from the detail modal', async ({ page }) => {
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Kommissar Pfote',
    library: 'Sihlcity',
    dueDate: '2099-08-11',
  });

  await page.goto('/');

  const statusChip = page.getByRole('button', {
    name: 'Change status of "Kommissar Pfote"',
  });
  await expect(statusChip).toHaveText('Loaned');
  await statusChip.click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('option', { name: 'Read', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(statusChip).toHaveText('Read');

  // Persisted: still read after a reload and stored in the database.
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Change status of "Kommissar Pfote"' })
  ).toHaveText('Read');
  const items = await getLoanItems();
  expect(items[0].status).toBe('READ');
});

test('changes a CD status to listened and back to loaned', async ({ page }) => {
  await insertLoanItem({
    mediaType: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    library: 'Sihlcity',
    dueDate: '2099-08-11',
  });

  await page.goto('/');

  const statusChip = page.getByRole('button', {
    name: 'Change status of "Kei Angscht vor em Hotzeplotz"',
  });
  await statusChip.click();

  // CD statuses use listening wording.
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('option', { name: 'Listened', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(statusChip).toHaveText('Listened');

  await statusChip.click();
  await dialog.getByRole('option', { name: 'Loaned', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(statusChip).toHaveText('Loaned');

  await page.reload();
  await expect(
    page.getByRole('button', {
      name: 'Change status of "Kei Angscht vor em Hotzeplotz"',
    })
  ).toHaveText('Loaned');
  const items = await getLoanItems();
  expect(items[0].status).toBe('LOANED');
});
