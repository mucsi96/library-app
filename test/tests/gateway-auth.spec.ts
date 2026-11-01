import { test, expect } from '../fixtures';

test('deep links bootstrap without browser OAuth credentials or environment config', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/import?source=bookmark');
  await expect(page).toHaveTitle('Import item');
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
  expect(requests.some(url => /\/api\/environment|\/default\/(authorize|token)/.test(url))).toBe(false);
  expect(await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter(key => /oidc|token/i.test(key)))).toEqual([]);
});

test('expired session redirects once with the deep link, without replaying a mutation', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
  await expect(page.getByText('No libraries yet.')).toBeVisible();
  await page.route('**/oauth2/start?*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Gateway sign-in</h1>' }));
  let attempts = 0;
  await page.route('**/api/libraries', route => {
    attempts += 1;
    return route.fulfill({ status: 401 });
  });
  await page.getByLabel('Library name').fill('Session expired');
  await page.getByRole('button', { name: 'Add library' }).click();
  await expect(page.getByRole('heading', { name: 'Gateway sign-in' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('rd')).toBe('/settings');
  expect(attempts).toBe(1);
});

test('authorization failures stay on the page instead of starting a login loop', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText('No libraries yet.')).toBeVisible();
  await page.route('**/api/libraries', route => route.fulfill({ status: 403, json: { detail: 'Access denied' } }));
  await page.getByLabel('Library name').fill('Forbidden');
  await page.getByRole('button', { name: 'Add library' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/settings');
});

test('API validates bearer credentials and removes runtime config', async ({ request, apiHeaders }) => {
  expect((await request.get('/api/items')).status()).toBe(401);
  expect((await request.get('/api/items', { headers: { Authorization: 'Bearer forged' } })).status()).toBe(401);
  expect((await request.get('/api/items', { headers: apiHeaders })).status()).toBe(200);
  expect((await request.get('/api/environment', { headers: apiHeaders })).status()).toBe(404);
});

test('mutations require matching CSRF cookie and header even with a bearer token', async ({ page, context, request, apiHeaders }) => {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
  await expect.poll(async () => (await context.cookies()).some(cookie => cookie.name === '__Host-XSRF-TOKEN')).toBe(true);
  const cookie = (await context.cookies()).find(cookie => cookie.name === '__Host-XSRF-TOKEN')!;
  expect(cookie).toMatchObject({ path: '/', secure: true, httpOnly: false, sameSite: 'Lax' });
  const data = { name: 'CSRF protected library' };
  expect((await page.request.post('/api/libraries', { headers: apiHeaders, data })).status()).toBe(403);
  expect((await page.request.post('/api/libraries', { headers: { ...apiHeaders, 'X-XSRF-TOKEN': 'forged' }, data })).status()).toBe(403);
  const headers = { ...apiHeaders, 'X-XSRF-TOKEN': cookie.value };
  expect((await request.post('/api/libraries', { headers, data })).status()).toBe(403);
  expect((await page.request.post('/api/libraries', { headers, data })).ok()).toBe(true);
});
