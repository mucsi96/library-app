import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures';
import { IMAGES, STORAGE_DIR, insertLibrary, insertLoanItem, query, writeThumbnail, readThumbnail } from '../utils';

test('rejects signed tokens with a different audience or without API scope and roles', async ({ request }) => {
  const issuer = 'http://localhost:8050/default';
  const redirect = 'http://localhost/test';
  for (const [clientId, status] of [['another-client', 401], ['mock-api-client-id', 403]] as const) {
    const authorization = await request.get(`${issuer}/authorize`, {
      params: { client_id: clientId, redirect_uri: redirect, response_type: 'code' }, maxRedirects: 0,
    });
    const code = new URL(authorization.headers()['location']).searchParams.get('code')!;
    const tokens = await request.post(`${issuer}/token`, {
      form: { grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirect, code },
    });
    expect(tokens.ok()).toBeTruthy();
    const { id_token: token } = await tokens.json();
    const proof = randomUUID();
    const headers = { Authorization: `Bearer ${token}`, Cookie: `__Host-XSRF-TOKEN=${proof}`, 'X-XSRF-TOKEN': proof };
    expect((await request.get('/api/items', { headers })).status()).toBe(status);
    expect((await request.post('/api/libraries', { headers, data: { name: 'Unauthorized' } })).status()).toBe(status);
  }
});

test('adopts populated tables and preserves identifiers, sequences, progress and staged photos on restart', async ({ page, request, apiHeaders }) => {
  test.setTimeout(60000);
  await insertLibrary('Existing branch');
  await insertLoanItem({ isbn: '9783440153598', mediaType: 'BOOK', title: 'Existing book', status: 'READ_RETURNED', library: 'Existing branch', dueDate: '2026-12-01' });
  const before = (await query('SELECT * FROM library.loan_items')).rows;
  const sequence = (await query('SELECT last_value, is_called FROM library.loan_items_id_seq')).rows;
  const reference = randomUUID();
  const front = `imports/${reference}-front.png`;
  const back = `imports/${reference}-back.png`;
  mkdirSync(join(STORAGE_DIR, 'imports'), { recursive: true });
  [front, back].forEach(path => writeFileSync(join(STORAGE_DIR, path), Buffer.from(IMAGES.unreadableFront, 'base64')));
  writeThumbnail('9783440153598', Buffer.from(IMAGES.generatedCover, 'base64'));
  await query(`INSERT INTO library.import_jobs (reference, status, front_photo, back_photo, title, media_type, attempts)
    VALUES ($1, 'NEEDS_ISBN', $2, $3, 'Waiting book', 'BOOK', 2)`, [reference, front, back]);
  const jobs = (await query('SELECT * FROM library.import_jobs')).rows;
  const jobSequence = (await query('SELECT last_value, is_called FROM library.import_jobs_id_seq')).rows;
  const libraries = (await query('SELECT * FROM library.libraries')).rows;
  // An existing installation has domain tables but no SeaORM migration history.
  // Re-run the baseline against populated tables, then verify the serving API.
  await query('DELETE FROM library.seaql_migrations');
  execFileSync('podman', ['restart', 'library-app-test-server'], { timeout: 30000 });
  await expect.poll(async () => {
    try { return (await request.get('/api/items', { headers: apiHeaders })).status(); }
    catch { return 0; }
  }, { timeout: 30000 }).toBe(200);
  expect((await query('SELECT * FROM library.loan_items')).rows).toEqual(before);
  expect((await query('SELECT last_value, is_called FROM library.loan_items_id_seq')).rows).toEqual(sequence);
  expect((await query('SELECT * FROM library.import_jobs')).rows).toEqual(jobs);
  expect((await query('SELECT last_value, is_called FROM library.import_jobs_id_seq')).rows).toEqual(jobSequence);
  expect((await query('SELECT * FROM library.libraries')).rows).toEqual(libraries);
  expect(readThumbnail('9783440153598')).toEqual(Buffer.from(IMAGES.generatedCover, 'base64'));
  const photo = await request.get(`/api/import-jobs/${reference}/photo`, { headers: apiHeaders });
  expect(photo.status()).toBe(200);
  expect(await photo.body()).toEqual(Buffer.from(IMAGES.unreadableFront, 'base64'));
  await page.goto('/');
  await expect(page.getByText('Existing book', { exact: true })).toBeVisible();
  await expect(page.getByText('Waiting book', { exact: true })).toBeVisible();
  await insertLoanItem({ mediaType: 'CD', title: 'New item' });
  const next = (await query("SELECT id FROM library.loan_items WHERE title = 'New item'")).rows[0].id;
  expect(BigInt(next)).toBeGreaterThan(BigInt(before[0].id));
});

test('preserves returned status between branches and rejects invalid or partial due-date updates', async ({ page, request, apiHeaders }) => {
  await page.goto('/');
  await insertLibrary('First');
  await insertLibrary('Second');
  await insertLoanItem({ mediaType: 'BOOK', title: 'Returned book', status: 'READ_RETURNED', library: 'First', dueDate: '2026-12-01' });
  await insertLoanItem({ mediaType: 'CD', title: 'Own CD', status: 'NOT_STARTED' });
  const items = (await query('SELECT * FROM library.loan_items ORDER BY title')).rows;
  const returned = items.find(item => item.title === 'Returned book');
  const own = items.find(item => item.title === 'Own CD');
  const proof = randomUUID();
  const headers = { ...apiHeaders, Cookie: `__Host-XSRF-TOKEN=${proof}`, 'X-XSRF-TOKEN': proof };
  const move = await request.put(`/api/items/${returned.id}/library`, { headers, data: { library: 'second' } });
  expect(move.status()).toBe(200);
  expect(await move.json()).toMatchObject({ library: 'Second', status: 'READ_RETURNED', dueDate: '2026-12-01' });
  expect((await request.put(`/api/items/${returned.id}/status`, { headers, data: { status: 'INVALID' } })).status()).toBe(400);
  expect((await request.put('/api/items/due-date', { headers, data: { ids: [Number(returned.id)], dueDate: 'not-a-date' } })).status()).toBe(400);
  expect((await request.put('/api/items/due-date', { headers, data: { ids: [Number(returned.id), Number(own.id)], dueDate: '2027-01-01' } })).status()).toBe(400);
  expect((await request.put('/api/items/due-date', { headers, data: { ids: [Number(returned.id), -1], dueDate: '2027-01-01' } })).status()).toBe(404);
  const unchanged = (await query('SELECT to_char(due_date, \'YYYY-MM-DD\') AS due FROM library.loan_items WHERE id = $1', [returned.id])).rows[0];
  expect(unchanged.due).toBe('2026-12-01');
});
