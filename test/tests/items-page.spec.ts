import { test, expect } from '../fixtures';
import {
  IMAGES,
  daysFromToday,
  getLoanItems,
  insertLibrary,
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

test('filters items by status', async ({ page }) => {
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Loaned book',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Finished book',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
    status: 'READ',
  });

  await page.goto('/');

  await page.getByRole('option', { name: 'Read', exact: true }).click();
  await expect(page.getByText('Loaned book')).not.toBeVisible();
  await expect(page.getByText('Finished book')).toBeVisible();

  // Clicking again clears the filter.
  await page.getByRole('option', { name: 'Read', exact: true }).click();
  await expect(page.getByText('Loaned book')).toBeVisible();
  await expect(page.getByText('Finished book')).toBeVisible();
});

test('status filter uses listening wording when only CDs have the status', async ({
  page,
}) => {
  await insertLoanItem({
    mediaType: 'CD',
    title: 'Finished CD',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
    status: 'READ',
  });

  await page.goto('/');

  await page.getByRole('option', { name: 'Listened', exact: true }).click();
  await expect(page.getByText('Finished CD')).toBeVisible();
});

test('uses watching wording for DVDs', async ({ page }) => {
  await insertLoanItem({
    mediaType: 'DVD',
    title: 'Finished DVD',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
    status: 'READ',
  });

  await page.goto('/');

  await expect(
    page.getByRole('cell', { name: 'DVD', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change status of "Finished DVD"' })
  ).toHaveText('Watched');

  // DVDs have their own type filter chip and status wording.
  await page.getByRole('option', { name: 'DVD', exact: true }).click();
  await page.getByRole('option', { name: 'Watched', exact: true }).click();
  await expect(page.getByText('Finished DVD')).toBeVisible();
});

test('shows an own unwatched DVD with watching statuses', async ({ page }) => {
  await insertLoanItem({
    mediaType: 'DVD',
    title: 'My own DVD',
    status: 'NOT_STARTED',
  });

  await page.goto('/');

  const statusChip = page.getByRole('button', {
    name: 'Change status of "My own DVD"',
  });
  await expect(statusChip).toHaveText('Unwatched');
  await statusChip.click();

  const dialog = page.getByRole('dialog');
  for (const status of ['Unwatched', 'Watching', 'Watched']) {
    await expect(
      dialog.getByRole('option', { name: status, exact: true })
    ).toBeVisible();
  }
  await expect(
    dialog.getByRole('option', { name: 'Loaned', exact: true })
  ).not.toBeVisible();
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
  await expect(
    ownRow.getByRole('cell', { name: 'My own', exact: true })
  ).toBeVisible();
  await expect(ownRow.getByText(/Due|Overdue/)).not.toBeVisible();

  // Own items have their own filter chip next to the libraries.
  await page.getByRole('option', { name: 'My own' }).click();
  await expect(page.getByText('Borrowed book')).not.toBeVisible();
  await expect(page.getByText('My own book')).toBeVisible();
});

test('sets a new due date for several selected items at once', async ({
  page,
}) => {
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Kommissar Pfote',
    library: 'Sihlcity',
    dueDate: daysFromToday(3),
  });
  await insertLoanItem({
    mediaType: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    library: 'Sihlcity',
    dueDate: daysFromToday(3),
  });
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Die drei ??? Kids',
    library: 'Oerlikon',
    dueDate: daysFromToday(3),
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Select', exact: true }).click();

  await page.getByRole('checkbox', { name: 'Select "Kommissar Pfote"' }).check();
  await page
    .getByRole('checkbox', { name: 'Select "Kei Angscht vor em Hotzeplotz"' })
    .check();
  await expect(page.getByText('2 items selected')).toBeVisible();

  await page.getByRole('button', { name: 'Set due date' }).click();

  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Set due date for 2 items' })
  ).toBeVisible();
  await dialog.getByLabel('Due date').fill(daysFromToday(20));
  await dialog.getByRole('button', { name: 'Save due date' }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Due in 20 days')).toHaveCount(2);

  const dueDates = new Map(
    (await getLoanItems()).map((item) => [item.title, item.due_date_iso])
  );
  expect(dueDates.get('Kommissar Pfote')).toBe(daysFromToday(20));
  expect(dueDates.get('Kei Angscht vor em Hotzeplotz')).toBe(daysFromToday(20));
  // The unselected item keeps its own deadline.
  expect(dueDates.get('Die drei ??? Kids')).toBe(daysFromToday(3));
});

test('selects every item matching the quick filters at once', async ({
  page,
}) => {
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Kommissar Pfote',
    library: 'Sihlcity',
    dueDate: daysFromToday(3),
  });
  await insertLoanItem({
    mediaType: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    library: 'Sihlcity',
    dueDate: daysFromToday(3),
  });
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Die drei ??? Kids',
    library: 'Oerlikon',
    dueDate: daysFromToday(3),
  });

  await page.goto('/');
  await page.getByRole('option', { name: 'Sihlcity' }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select all' }).check();

  await expect(page.getByText('2 items selected')).toBeVisible();

  await page.getByRole('button', { name: 'Set due date' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Due date').fill(daysFromToday(28));
  await dialog.getByRole('button', { name: 'Save due date' }).click();

  await expect(page.getByText('Due date updated for 2 items')).toBeVisible();

  const dueDates = new Map(
    (await getLoanItems()).map((item) => [item.title, item.due_date_iso])
  );
  expect(dueDates.get('Kommissar Pfote')).toBe(daysFromToday(28));
  expect(dueDates.get('Kei Angscht vor em Hotzeplotz')).toBe(daysFromToday(28));
  // The item hidden by the library filter is untouched.
  expect(dueDates.get('Die drei ??? Kids')).toBe(daysFromToday(3));
});

test('offers no due date change while an own item is selected', async ({
  page,
}) => {
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'My own book',
    status: 'READING',
  });
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Borrowed book',
    library: 'Sihlcity',
    dueDate: daysFromToday(5),
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select all' }).check();

  await expect(
    page.getByText('Own items have no due date. Unselect them to set one.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set due date' })).toBeDisabled();

  // Dropping the own item makes the bulk change available again.
  await page.getByRole('checkbox', { name: 'Select "My own book"' }).uncheck();
  await expect(page.getByText('1 item selected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set due date' })).toBeEnabled();
});

test('drops items hidden by a filter change out of the selection', async ({
  page,
}) => {
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Kommissar Pfote',
    library: 'Sihlcity',
    dueDate: daysFromToday(3),
  });
  await insertLoanItem({
    mediaType: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    library: 'Sihlcity',
    dueDate: daysFromToday(3),
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select all' }).check();
  await expect(page.getByText('2 items selected')).toBeVisible();

  // The CD leaves the list, so it leaves the selection - and clearing the
  // filter again does not bring it back selected.
  await page.getByRole('option', { name: 'Book', exact: true }).click();
  await expect(page.getByText('1 item selected')).toBeVisible();

  await page.getByRole('option', { name: 'Book', exact: true }).click();
  await expect(page.getByText('1 item selected')).toBeVisible();
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

test('changes the library from the detail modal', async ({ page }) => {
  await insertLibrary('Sihlcity');
  await insertLibrary('Oerlikon');
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Kommissar Pfote',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });

  await page.goto('/');
  await page
    .getByRole('button', { name: 'Show details of "Kommissar Pfote"' })
    .click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('option', { name: 'Oerlikon' }).click();
  await dialog.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('cell', { name: 'Oerlikon' })).toBeVisible();
  const items = await getLoanItems();
  expect(items[0].library).toBe('Oerlikon');
});

test('moves an item to my own and back from the detail modal', async ({
  page,
}) => {
  await insertLibrary('Sihlcity');
  await insertLoanItem({
    mediaType: 'BOOK',
    title: 'Kommissar Pfote',
    library: 'Sihlcity',
    dueDate: daysFromToday(12),
  });

  await page.goto('/');
  await page
    .getByRole('button', { name: 'Show details of "Kommissar Pfote"' })
    .click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('option', { name: 'My own' }).click();

  // Own items have no due date and only track reading progress; a loaned
  // item was never started, so on the own shelf it is unread.
  await expect(
    dialog.getByRole('option', { name: 'Unread', exact: true })
  ).toBeVisible();
  await expect(
    dialog.getByRole('option', { name: 'Reading', exact: true })
  ).toBeVisible();
  await expect(
    dialog.getByRole('option', { name: 'Loaned', exact: true })
  ).not.toBeVisible();
  await expect(dialog.getByText(/Due in/)).not.toBeVisible();

  let items = await getLoanItems();
  expect(items[0].library).toBeNull();
  expect(items[0].status).toBe('NOT_STARTED');
  expect(items[0].due_date).toBeNull();

  // Picking a library again turns it back into a loan with a due date, and
  // the untouched item is loaned - not unread - again.
  await dialog.getByRole('option', { name: 'Sihlcity' }).click();
  await expect(dialog.getByText('Due in 28 days')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();

  items = await getLoanItems();
  expect(items[0].library).toBe('Sihlcity');
  expect(items[0].due_date).not.toBeNull();
  expect(items[0].status).toBe('LOANED');
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
