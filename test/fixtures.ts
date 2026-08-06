import { test as base, TestInfo } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { cleanupDb } from './utils';

export const test = base.extend({
  page: async ({ page }, use, testInfo: TestInfo) => {
    await cleanupDb();

    // Keep tests hermetic: Google Books lookups find nothing unless a test
    // registers its own (later, thus higher-priority) route.
    await page.route('https://www.googleapis.com/books/v1/volumes*', (route) =>
      route.fulfill({
        json: {},
        headers: { 'Access-Control-Allow-Origin': '*' },
      })
    );

    // Capture browser console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      const timestamp = new Date().toISOString();
      consoleLogs.push(
        `[${timestamp}] [${type.toUpperCase()}] ${text} (${location.url}:${location.lineNumber})`
      );
    });

    page.on('pageerror', (error) => {
      const timestamp = new Date().toISOString();
      consoleLogs.push(`[${timestamp}] [PAGE_ERROR] ${error.message}\n${error.stack}`);
    });

    // Now expose the page to tests
    await use(page);

    // Save console logs on test failure
    if (testInfo.status !== testInfo.expectedStatus && consoleLogs.length > 0) {
      const outputDir = testInfo.outputDir;
      mkdirSync(outputDir, { recursive: true });
      const logPath = join(outputDir, 'console-logs.txt');
      writeFileSync(logPath, consoleLogs.join('\n'));
      testInfo.attachments.push({
        name: 'console-logs',
        path: logPath,
        contentType: 'text/plain',
      });
    }
  },
});

export { expect } from '@playwright/test';
