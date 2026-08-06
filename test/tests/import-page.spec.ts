import { test, expect } from '../fixtures';
import {
  IMAGES,
  daysFromToday,
  getLoanItems,
  insertLoanItem,
  photo,
  readThumbnail,
  writeThumbnail,
} from '../utils';

const LOAN_PERIOD_DAYS = 28;

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

  // Lands on the loans list with the imported item and its generated cover.
  await expect(page.getByRole('heading', { name: 'My loans' })).toBeVisible();
  await expect(
    page.getByText('Die drei ??? Kids - Diebe im Tierpark')
  ).toBeVisible();
  await expect(page.getByText('Anne Scheller')).toBeVisible();
  await expect(page.getByText(`Due in ${LOAN_PERIOD_DAYS} days`)).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Cover of "Die drei ??? Kids - Diebe im Tierpark"',
    })
  ).toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(1);
  // The hyphenated ISBN read from the photos is normalized to ISBN-13.
  expect(items[0]).toMatchObject({
    isbn: '9783440153598',
    media_type: 'BOOK',
    title: 'Die drei ??? Kids - Diebe im Tierpark',
    author: 'Anne Scheller',
    library: 'Sihlcity',
    completed: false,
  });
  expect(items[0].due_date_iso).toBe(daysFromToday(LOAN_PERIOD_DAYS));

  // The cleaned cover generated from the front photo is stored by ISBN-13.
  expect(readThumbnail('9783440153598')).toEqual(
    Buffer.from(IMAGES.generatedCover, 'base64')
  );
});

test('imports a CD labelled with an ISBN-10', async ({ page }) => {
  await page.goto('/import');

  await page
    .getByLabel('Front photo')
    .setInputFiles(photo('front.png', IMAGES.cdFront));
  await page
    .getByLabel('Back photo')
    .setInputFiles(photo('back.png', IMAGES.generatedCover));
  await page.getByRole('button', { name: 'Import item' }).click();

  await expect(page.getByRole('heading', { name: 'My loans' })).toBeVisible();
  await expect(page.getByText('Kei Angscht vor em Hotzeplotz')).toBeVisible();

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

test('rejects photos when no valid ISBN is readable', async ({ page }) => {
  await page.goto('/import');

  await page
    .getByLabel('Front photo')
    .setInputFiles(photo('front.png', IMAGES.unreadableFront));
  await page
    .getByLabel('Back photo')
    .setInputFiles(photo('back.png', IMAGES.generatedCover));
  await page.getByRole('button', { name: 'Import item' }).click();

  await expect(page.getByRole('alert')).toContainText(
    'No valid ISBN found on the photos.'
  );
  // Stays on the import page and nothing is stored.
  await expect(page.getByRole('heading', { name: 'Import item' })).toBeVisible();
  expect(await getLoanItems()).toHaveLength(0);
});

test('re-importing an item refreshes the loan without duplicating or losing the read status', async ({
  page,
}) => {
  await insertLoanItem({
    isbn: '9783440153598',
    mediaType: 'BOOK',
    title: 'Die drei ??? Kids - Diebe im Tierpark',
    library: 'Sihlcity',
    dueDate: daysFromToday(-2),
    completed: true,
  });
  // The item already has a thumbnail from its first import.
  const existingThumbnail = Buffer.from(IMAGES.unreadableFront, 'base64');
  writeThumbnail('9783440153598', existingThumbnail);

  await page.goto('/import');
  await page
    .getByLabel('Front photo')
    .setInputFiles(photo('front.png', IMAGES.bookFront));
  await page
    .getByLabel('Back photo')
    .setInputFiles(photo('back.png', IMAGES.generatedCover));
  await page.getByRole('button', { name: 'Import item' }).click();
  await expect(page.getByRole('heading', { name: 'My loans' })).toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(1);
  // The book kept its read status but got a fresh due date.
  expect(items[0].completed).toBe(true);
  expect(items[0].due_date_iso).toBe(daysFromToday(LOAN_PERIOD_DAYS));
  // The existing thumbnail is reused instead of being regenerated.
  expect(readThumbnail('9783440153598')).toEqual(existingThumbnail);
});
