import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import {
  IMAGES,
  configureMockOpenAI,
  daysFromToday,
  getImportJobs,
  getLoanItems,
  insertLoanItem,
  photo,
  readThumbnail,
  writeThumbnail,
} from '../utils';

const LOAN_PERIOD_DAYS = 28;
const BOOK_TITLE = 'Die drei ??? Kids - Diebe im Tierpark';

/** Takes both photos and hands the item to the background worker. */
async function queueImport(page: Page, front: string) {
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
  await page.goto('/');
  await page.getByRole('link', { name: 'Import', exact: true }).click();

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
  // The hyphenated ISBN read from the photos is normalized to ISBN-13.
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

test('shows what the AI is doing while an import is processed', async ({
  page,
}) => {
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
  await page.goto('/import');
  await queueImport(page, IMAGES.cdFront);

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
  await configureMockOpenAI({ delayMs: 1000 });

  await page.goto('/import');
  await queueImport(page, IMAGES.bookFront);
  // The second item is captured while the first is still being processed.
  await queueImport(page, IMAGES.cdFront);

  expect(await getImportJobs()).toHaveLength(2);

  await page.getByRole('link', { name: 'My loans' }).click();

  const loans = loansTable(page);
  await expect(loans.getByText(BOOK_TITLE)).toBeVisible();
  await expect(loans.getByText('Kei Angscht vor em Hotzeplotz')).toBeVisible();
  expect(await getLoanItems()).toHaveLength(2);
});

test('reports an import whose ISBN could not be read and lets it be dismissed', async ({
  page,
}) => {
  await page.goto('/import');
  await queueImport(page, IMAGES.unreadableFront);

  await expect(page.getByRole('alert')).toContainText(
    'No valid ISBN found on the photos.'
  );
  // Nothing is stored for a failed import.
  expect(await getLoanItems()).toHaveLength(0);

  await page.getByRole('button', { name: /^Dismiss failed import/ }).click();

  await expect(page.getByRole('heading', { name: 'Processing' })).not.toBeVisible();
  expect(await getImportJobs()).toHaveLength(0);
});

test('retries a rate limited import without retaking the photos', async ({
  page,
}) => {
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
