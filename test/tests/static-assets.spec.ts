import { createServer, type Server } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { test, expect } from '../fixtures';

let server: Server;
let directory: string;
let assetOrigin: string;
let html: string;
const assetCookies: string[] = [];

test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'library-static-'));
  const assets = join(directory, 'published', 'assets');
  server = createServer(async (request, response) => {
    assetCookies.push(request.headers.cookie ?? '');
    const path = resolve(assets, `.${new URL(request.url!, 'http://localhost').pathname}`);
    if (!path.startsWith(`${assets}/`)) { response.writeHead(400).end(); return; }
    try {
      const body = await readFile(path);
      const types: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
      response.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing asset server address');
  assetOrigin = `http://127.0.0.1:${address.port}`;
  execFileSync(process.execPath, ['../scripts/prepare-client.mjs', '../client/dist', join(directory, 'published'), `${assetOrigin}/`, 'http://localhost:8150']);
  html = await readFile(join(directory, 'published/documents/index.html'), 'utf8');
});

test.afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('published document loads real cross-origin bundles, lazy routes and manifest without credentials', async ({ page, context }) => {
  // The substitute Blob server is on loopback; Chromium gates local-network
  // requests separately from CORS. Production assets are on a public origin.
  await context.grantPermissions(['local-network-access']);
  const errors: string[] = [];
  const assets: string[] = [];
  const telemetry: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().startsWith(assetOrigin)) assets.push(request.url());
    if (request.url().includes('/_telemetry/collect')) telemetry.push(request.url());
  });
  // A cookie on the asset host would leak if script/link requests used credentials.
  await context.addCookies([{ name: 'asset-credential-probe', value: 'must-not-leak', url: assetOrigin }]);
  await page.route('http://localhost:8150/import?source=static', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/import?source=static');
  await expect(page.getByRole('heading', { name: 'Import item' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('link', { name: 'My loans' }).click();
  await expect(page.getByRole('heading', { name: 'My loans' })).toBeVisible();
  expect(assets.some(url => /chunk-Import-.*\.js$/.test(url))).toBe(true);
  expect(assets.some(url => /chunk-Settings-.*\.js$/.test(url))).toBe(true);
  expect(assets.some(url => /chunk-Items-.*\.js$/.test(url))).toBe(true);
  expect(assets.some(url => url.endsWith('.css'))).toBe(true);
  expect(assetCookies.every(cookie => cookie === '')).toBe(true);
  expect(errors).toEqual([]);
  expect(new URL(page.url()).origin).toBe('http://localhost:8150');
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;
    return (await fetch(link.href, { credentials: 'omit' })).json();
  });
  expect(manifest.start_url).toBe('http://localhost:8150/');
  expect(manifest.scope).toBe('http://localhost:8150/');
  await expect.poll(() => telemetry.length).toBeGreaterThan(0);
  expect(telemetry.every(url => new URL(url).origin === 'http://localhost:8150')).toBe(true);
});
