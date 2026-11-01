import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, expect } from '@playwright/test';
import { prepareClient } from '../scripts/prepare-client.mjs';

const directory = await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'library-assets-'));
const credentials = [];
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const assets = createServer(async (req, res) => {
  credentials.push([req.headers.cookie, req.headers.authorization]);
  const url = new URL(req.url, assetBaseUrl);
  if (!url.searchParams.has('no-cors')) res.setHeader('Access-Control-Allow-Origin', appOrigin);
  try {
    const path = resolve(directory, 'assets', `.${url.pathname}`);
    if (!path.startsWith(`${join(directory, 'assets')}/`)) throw new Error('Invalid path');
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
const documents = createServer(async (req, res) => {
  const path = new URL(req.url, appOrigin).pathname;
  if (['/api/items', '/api/libraries', '/api/import-jobs'].includes(path)) {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('[]');
  } else if (path === '/oauth2/userinfo') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"email":"test@example.test","additionalClaims":{"name":"Test User"}}');
  } else if (req.headers.accept?.includes('text/html')) {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(await readFile(join(directory, 'documents/index.html')));
  } else { res.writeHead(404).end(); }
});
await listen(assets);
await listen(documents);
const appOrigin = `http://localhost:${documents.address().port}`;
const assetBaseUrl = `http://127.0.0.1:${assets.address().port}/`;
const browser = await chromium.launch();
try {
  await prepareClient(resolve('client/dist'), directory, assetBaseUrl, appOrigin);
  const context = await browser.newContext();
  await context.addCookies([{ name: 'fixture-session', value: 'private', url: appOrigin }]);
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (['script', 'stylesheet', 'font', 'image', 'manifest'].includes(request.resourceType())) requests.push(request.url());
  });
  await page.route('**/_telemetry/collect', route => route.fulfill({ status: 202, body: 'ok' }));
  const telemetry = page.waitForRequest(request => request.url() === `${appOrigin}/_telemetry/collect` && request.method() === 'POST');
  await page.goto(`${appOrigin}/import?source=bookmark`);
  await expect(page).toHaveTitle('Import item');
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
  assert.equal((await telemetry).postDataJSON().meta.app.name, 'library-client');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveTitle('Settings');
  await page.reload();
  await expect(page).toHaveTitle('Settings');
  await page.evaluate(async () => {
    for (const font of ['400 16px Roboto', '400 24px "Material Icons"']) {
      if (!(await document.fonts.load(font)).length) throw new Error(`Missing bundled font: ${font}`);
    }
  });
  assert.equal(await page.evaluate(() => document.baseURI), `${appOrigin}/`);
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href, { credentials: 'omit' })).json());
  for (const field of ['id', 'scope', 'start_url']) assert.equal(manifest[field], `${appOrigin}/`);
  await page.evaluate(url => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = url;
  }), new URL(manifest.icons[0].src, assetBaseUrl).href);
  for (const suffix of ['.js', '.css', '.woff2', '.png']) assert(requests.some(url => url.endsWith(suffix)), `Missing ${suffix} request`);
  assert(requests.some(url => /\/chunk-.*\.js$/.test(url)), 'Lazy modules must load from storage');
  assert(requests.every(url => url.startsWith(assetBaseUrl)), `Asset escaped storage: ${requests}`);
  assert.equal(await page.evaluate(async url => (await fetch(url)).status, `${assetBaseUrl}missing.js`), 404);
  assert(await page.evaluate(async url => { try { await fetch(url); return false; } catch { return true; } }, `${requests.find(url => url.endsWith('.js'))}?no-cors`));
  assert(credentials.length > 0 && credentials.every(pair => pair.every(value => !value)));
  assert.deepEqual(errors, []);
  console.log('Direct asset browser checks passed: lazy routes, CORS, credential isolation, fonts/icons, manifest, Faro.');
} finally {
  await browser.close();
  assets.closeAllConnections(); documents.closeAllConnections();
  await Promise.all([new Promise(resolve => assets.close(resolve)), new Promise(resolve => documents.close(resolve))]);
  await rm(directory, { recursive: true, force: true });
}
