import { test, expect } from '../fixtures';
import { getLoanItems, insertLoanItem } from '../utils';

const LOANS_TABLE_HTML = `
<table class="rTable_table" id="resptable-1" width="100%" role="table">
  <thead class="rTable_head" role="rowgroup">
    <tr role="row">
      <th scope="col" role="columnheader" class="rTable_th"><span class="invisible">Markieren</span></th>
      <th scope="col" role="columnheader" class="rTable_th">Fällig am</th>
      <th scope="col" role="columnheader" class="rTable_th">Bibliothek</th>
      <th scope="col" role="columnheader" class="rTable_th">Titel</th>
      <th scope="col" role="columnheader" class="rTable_th">Hinweis</th>
    </tr>
  </thead>
  <tbody role="rowgroup">
    <tr class=" rTable_tr_even " role="row">
      <td class=" rTable_td_check" role="cell"><input type="checkbox" name="checkbox[]" value="CheckCell"></td>
      <td class=" rTable_td_text" role="cell">11.08.2026</td>
      <td class=" rTable_td_text" role="cell">Sihlcity</td>
      <td class=" rTable_td_text" role="cell">[CD]<br> Kei Angscht vor em Hotzeplotz / Otfried Preussler ; [mit] Inigo Gallo, Vincenzo Biagi<br>Kinder-CD-Mundart ab 4<br>30001020102858</td>
      <td class=" rTable_td_text" role="cell">verlängerbar - Stand 05.08.2026<br>verlängerbar - Stand 21.07.2026</td>
    </tr>
    <tr class=" rTable_tr_odd " role="row">
      <td class=" rTable_td_check" role="cell"><input type="checkbox" name="checkbox[]" value="CheckCell_0"></td>
      <td class=" rTable_td_text" role="cell">11.08.2026</td>
      <td class=" rTable_td_text" role="cell">Sihlcity</td>
      <td class=" rTable_td_text" role="cell">[Druckschrift]<br> ¬Die¬ drei ??? Kids - Diebe im Tierpark / von Anne Scheller<br>-DREI-J<br>30001025647330</td>
      <td class=" rTable_td_text" role="cell">verlängerbar - Stand 05.08.2026<br>verlängerbar - Stand 21.07.2026</td>
    </tr>
  </tbody>
</table>`;

test('imports items from pasted library page HTML', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Import', exact: true }).click();

  await page.getByLabel('Loans page HTML').fill(LOANS_TABLE_HTML);

  // Preview shows the parsed items before importing.
  await expect(page.getByText('2 item(s) found')).toBeVisible();
  await expect(page.getByText('Kei Angscht vor em Hotzeplotz')).toBeVisible();
  await expect(
    page.getByText('Die drei ??? Kids - Diebe im Tierpark')
  ).toBeVisible();
  await expect(page.getByText('Anne Scheller')).toBeVisible();

  await page.getByRole('button', { name: 'Import 2 item(s)' }).click();

  // Lands on the loans list with the imported items.
  await expect(page.getByRole('heading', { name: 'My loans' })).toBeVisible();
  await expect(page.getByText('Kei Angscht vor em Hotzeplotz')).toBeVisible();
  await expect(
    page.getByText('Die drei ??? Kids - Diebe im Tierpark')
  ).toBeVisible();
  await expect(page.getByText('11.08.2026').first()).toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({
    barcode: '30001020102858',
    media_type: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    author: 'Otfried Preussler',
    library: 'Sihlcity',
    note: 'verlängerbar - Stand 05.08.2026',
    completed: false,
  });
  expect(items[1]).toMatchObject({
    barcode: '30001025647330',
    media_type: 'BOOK',
    title: 'Die drei ??? Kids - Diebe im Tierpark',
    author: 'Anne Scheller',
    category: '-DREI-J',
  });
});

test('re-importing updates existing items without duplicating or losing read status', async ({
  page,
}) => {
  await insertLoanItem({
    barcode: '30001020102858',
    mediaType: 'CD',
    title: 'Kei Angscht vor em Hotzeplotz',
    library: 'Sihlcity',
    dueDate: '2026-07-28',
    completed: true,
  });

  await page.goto('/import');
  await page.getByLabel('Loans page HTML').fill(LOANS_TABLE_HTML);
  await page.getByRole('button', { name: 'Import 2 item(s)' }).click();
  await expect(page.getByRole('heading', { name: 'My loans' })).toBeVisible();

  const items = await getLoanItems();
  expect(items).toHaveLength(2);
  // The existing CD kept its listened status but got the renewed due date.
  expect(items[0].completed).toBe(true);
  expect(items[0].due_date_iso).toBe('2026-08-11');
});

test('reports when no items can be parsed', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Loans page HTML').fill('<p>not a loans table</p>');
  await expect(
    page.getByText('No loan items found in the pasted HTML.')
  ).toBeVisible();
});
