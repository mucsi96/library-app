import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import {
  IMAGES,
  configureMockOpenAI,
  daysFromToday,
  getImportJobs,
  getLoanItems,
  insertLibrary,
  insertLoanItem,
  photo,
  readThumbnail,
  writeThumbnail,
} from '../utils';

const LOAN_PERIOD_DAYS = 28;
const BOOK_TITLE = 'Die drei ??? Kids - Diebe im Tierpark';

/**
 * Picks the source, takes both photos and hands the item to the background
 * worker. The source chip stays selected between imports, so it is only
 * clicked when not already active.
 */
async function queueImport(page: Page, front: string, source = 'Sihlcity') {
  const sourceChip = page.getByRole('option', { name: source, exact: true });
  if ((await sourceChip.getAttribute('aria-selected')) !== 'true') {
    await sourceChip.click();
  }
  await page.getByLabel('Front photo').setInputFiles(photo('front.png', front));
  await page
    .getByLabel('Back photo')
    .setInputFiles(photo('back.png', IMAGES.generatedCover));
  await page.getByRole('button', { name: 'Import item' }).click();
  // The page clearing itself is the signal that the upload was accepted
  // and the next item can be captured.
  await expect(page.getByAltText('Front photo preview')).not.toBeVisible();
}

/** The loans table, so assertions never match the processing cards. */
const loansTable = (page: Page) => page.getByRole('table');

/** The processing section, so assertions never match the loans table. */
const processing = (page: Page) =>
  page.getByRole('region', { name: 'Processing' });

test('imports a book from front and back photos', async ({ page }) => {
  await insertLibrary('Sihlcity');

  await page.goto('/');
  await page.getByRole('link', { name: 'Import', exact: true }).click();

  // Nothing can be imported until the source is picked.
  await expect(page.getByRole('button', { name: 'Import item' })).toBeDisabled();
  await page.getByRole('option', { name: 'Sihlcity' }).click();

  await page
    .getByLabel('Front photo')
    .setInputFiles(photo('front.png', IMAGES.bookFront));
  await expect(page.getByAltText('Front photo preview')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retake front photo' })
  ).toBeVisible();

  await page
    .getByLabel('Back photo')
    .setInputFiles(photo('back.png', IMAGES.generatedCover));
  await expect(page.getByAltText('Back photo preview')).toBeVisible();

  await page.getByRole('button', { name: 'Import item' }).click();

  // The camera is free again immediately: the page stays put and the
  // photos are cleared for the next item.
  await expect(page.getByRole('heading', { name: 'Import item' })).toBeVisible();
  await expect(page.getByAltText('Front photo preview')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Processing' })).toBeVisible();

  await page.getByRole('link', { name: 'My loans' }).click();

  const loans = loansTable(page);
  await expect(loans.getByText(BOOK_TITLE)).toBeVisible();
  await expect(loans.getByText('Anne Scheller')).toBeVisible();
  await expect(loans.getByText(`Due in ${LOAN_PERIOD_DAYS} days`)).toBeVisible();
  await expect(
    loans.getByRole('img', { name: `Cover of "${BOOK_TITLE}"` })
  ).toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(1);
  // The hyphenated ISBN read from the photos is normalized to ISBN-13; the
  // library comes from the picked source, not from the photos.
  expect(items[0]).toMatchObject({
    isbn: '9783440153598',
    media_type: 'BOOK',
    title: BOOK_TITLE,
    author: 'Anne Scheller',
    library: 'Sihlcity',
    status: 'LOANED',
  });
  expect(items[0].due_date_iso).toBe(daysFromToday(LOAN_PERIOD_DAYS));

  // The cleaned cover generated from the front photo is stored by ISBN-13.
  expect(readThumbnail('9783440153598')).toEqual(
    Buffer.from(IMAGES.generatedCover, 'base64')
  );
});

test('imports the user\'s own book without a library or a due date', async ({
  page,
}) => {
  await page.goto('/import');
  await queueImport(page, IMAGES.bookFront, 'My own');

  await expect(processing(page).getByText('Added to your loans')).toBeVisible();

  await page.getByRole('link', { name: 'My loans' }).click();
  const loans = loansTable(page);
  await expect(loans.getByText(BOOK_TITLE)).toBeVisible();
  const row = loans.getByRole('row').filter({ hasText: BOOK_TITLE });
  await expect(
    row.getByRole('cell', { name: 'My own', exact: true })
  ).toBeVisible();
  await expect(row.getByText(/Due|Overdue/)).not.toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    isbn: '9783440153598',
    library: null,
    due_date: null,
    status: 'READING',
  });

  // Own items only track reading progress - no loan statuses.
  await loans
    .getByRole('button', { name: `Show details of "${BOOK_TITLE}"` })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('My own')).toBeVisible();
  await expect(
    dialog.getByRole('option', { name: 'Reading', exact: true })
  ).toBeVisible();
  await expect(
    dialog.getByRole('option', { name: 'Loaned', exact: true })
  ).not.toBeVisible();
});

test('shows what the AI is doing while an import is processed', async ({
  page,
}) => {
  await insertLibrary('Sihlcity');
  // Slow enough that each stage survives a client poll.
  await configureMockOpenAI({ delayMs: 3000 });

  await page.goto('/import');
  await queueImport(page, IMAGES.bookFront);

  const card = processing(page);
  await expect(card.getByText('Reading the ISBN…')).toBeVisible();

  // Once the ISBN is read the item can be named, even though the cover is
  // still being drawn.
  await expect(card.getByText('Drawing the cover…')).toBeVisible();
  await expect(card.getByText(BOOK_TITLE)).toBeVisible();

  await expect(card.getByText('Added to your loans')).toBeVisible();
});

test('imports a CD labelled with an ISBN-10', async ({ page }) => {
  await insertLibrary('Oerlikon');

  await page.goto('/import');
  await queueImport(page, IMAGES.cdFront, 'Oerlikon');

  await page.getByRole('link', { name: 'My loans' }).click();
  await expect(
    loansTable(page).getByText('Kei Angscht vor em Hotzeplotz')
  ).toBeVisible();

  const items = await getLoanItems();
  // The ISBN-10 on the CD is converted to ISBN-13.
  expect(items[0]).toMatchObject({
    isbn: '9784257178293',
    media_type: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    author: 'Otfried Preussler',
    library: 'Oerlikon',
  });
  expect(readThumbnail('9784257178293')).toEqual(
    Buffer.from(IMAGES.generatedCover, 'base64')
  );
});

test('queues several items back to back without waiting for the AI', async ({
  page,
}) => {
  await insertLibrary('Sihlcity');
  await configureMockOpenAI({ delayMs: 1000 });

  await page.goto('/import');
  await queueImport(page, IMAGES.bookFront);
  // The second item is captured while the first is still being processed,
  // reusing the already selected source.
  await queueImport(page, IMAGES.cdFront);

  expect(await getImportJobs()).toHaveLength(2);

  await page.getByRole('link', { name: 'My loans' }).click();

  const loans = loansTable(page);
  await expect(loans.getByText(BOOK_TITLE)).toBeVisible();
  await expect(loans.getByText('Kei Angscht vor em Hotzeplotz')).toBeVisible();
  expect(await getLoanItems()).toHaveLength(2);
});

test('asks for the ISBN when none can be read and finishes after manual entry', async ({
  page,
}) => {
  await insertLibrary('Sihlcity');

  await page.goto('/import');
  await queueImport(page, IMAGES.unreadableFront);

  const card = processing(page);
  await expect(card.getByRole('alert')).toContainText(
    'No valid ISBN found on the photos.'
  );
  // Nothing is stored while the import waits for the ISBN.
  expect(await getLoanItems()).toHaveLength(0);

  // A typo fails the check-digit validation right on the card, with the
  // import kept waiting.
  await card.getByLabel('ISBN').fill('978-3-16-148410-9');
  await card.getByRole('button', { name: 'Save ISBN' }).click();
  await expect(card.getByRole('alert').last()).toContainText(
    'Not a valid ISBN'
  );

  // The corrected ISBN finishes the import using the staged photos.
  await card.getByLabel('ISBN').fill('978-3-16-148410-0');
  await card.getByRole('button', { name: 'Save ISBN' }).click();

  await expect(card.getByText('Added to your loans')).toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    isbn: '9783161484100',
    title: 'Some item',
    library: 'Sihlcity',
    status: 'LOANED',
  });
  expect(readThumbnail('9783161484100')).toEqual(
    Buffer.from(IMAGES.generatedCover, 'base64')
  );
});

test('dismisses an import that is waiting for an ISBN', async ({ page }) => {
  await insertLibrary('Sihlcity');

  await page.goto('/import');
  await queueImport(page, IMAGES.unreadableFront);

  await expect(processing(page).getByRole('alert')).toContainText(
    'No valid ISBN found on the photos.'
  );

  await page.getByRole('button', { name: /^Dismiss import of/ }).click();

  await expect(page.getByRole('heading', { name: 'Processing' })).not.toBeVisible();
  expect(await getImportJobs()).toHaveLength(0);
  expect(await getLoanItems()).toHaveLength(0);
});

test('retries a rate limited import without retaking the photos', async ({
  page,
}) => {
  await insertLibrary('Sihlcity');
  // Exhausts max-attempts (3 in the test profile), then recovers.
  await configureMockOpenAI({
    failWith: { status: 429, count: 3, retryAfter: 1 },
  });

  await page.goto('/import');
  await queueImport(page, IMAGES.bookFront);

  await expect(page.getByRole('alert')).toContainText('was busy');

  await page.getByRole('button', { name: /^Retry importing/ }).click();

  // The staged photos are reused, so the item lands without the user
  // touching the camera again.
  await page.getByRole('link', { name: 'My loans' }).click();
  await expect(loansTable(page).getByText(BOOK_TITLE)).toBeVisible();
  expect(await getLoanItems()).toHaveLength(1);
});

test('re-importing an item refreshes the loan without duplicating or losing the read status', async ({
  page,
}) => {
  await insertLibrary('Sihlcity');
  await insertLoanItem({
    isbn: '9783440153598',
    mediaType: 'BOOK',
    title: BOOK_TITLE,
    library: 'Sihlcity',
    dueDate: daysFromToday(-2),
    status: 'READ',
  });
  // The item already has a thumbnail from its first import.
  const existingThumbnail = Buffer.from(IMAGES.unreadableFront, 'base64');
  writeThumbnail('9783440153598', existingThumbnail);

  await page.goto('/import');
  await queueImport(page, IMAGES.bookFront);

  await expect(processing(page).getByText('Added to your loans')).toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(1);
  // The book kept its read status but got a fresh due date.
  expect(items[0].status).toBe('READ');
  expect(items[0].due_date_iso).toBe(daysFromToday(LOAN_PERIOD_DAYS));
  // The existing thumbnail is reused instead of being regenerated.
  expect(readThumbnail('9783440153598')).toEqual(existingThumbnail);
});

test('re-importing an unread returned item makes it loaned again', async ({
  page,
}) => {
  await insertLibrary('Sihlcity');
  await insertLoanItem({
    isbn: '9783440153598',
    mediaType: 'BOOK',
    title: BOOK_TITLE,
    library: 'Sihlcity',
    dueDate: daysFromToday(-30),
    status: 'UNREAD_RETURNED',
  });
  writeThumbnail('9783440153598', Buffer.from(IMAGES.generatedCover, 'base64'));

  await page.goto('/import');
  await queueImport(page, IMAGES.bookFront);

  await expect(processing(page).getByText('Added to your loans')).toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(1);
  expect(items[0].status).toBe('LOANED');
});

test('re-importing a read returned item makes it read again', async ({
  page,
}) => {
  await insertLibrary('Sihlcity');
  await insertLoanItem({
    isbn: '9783440153598',
    mediaType: 'BOOK',
    title: BOOK_TITLE,
    library: 'Sihlcity',
    dueDate: daysFromToday(-30),
    status: 'READ_RETURNED',
  });
  writeThumbnail('9783440153598', Buffer.from(IMAGES.generatedCover, 'base64'));

  await page.goto('/import');
  await queueImport(page, IMAGES.bookFront);

  await expect(processing(page).getByText('Added to your loans')).toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(1);
  expect(items[0].status).toBe('READ');
});
