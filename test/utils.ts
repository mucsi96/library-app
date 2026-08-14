import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5451,
  database: 'test',
  user: 'postgres',
  password: 'postgres',
});

// Mounted into the server container as /app/storage (see test-pod.yaml).
export const STORAGE_DIR = path.join(__dirname, 'storage');

// Solid color 10x10 PNGs, source: https://png-pixel.com
// The mock OpenAI server keys its canned answers off these exact images
// (see mock_openai_server/src/data.ts).
export const IMAGES = {
  bookFront: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8/5/hPwMRgHFUIX0VAgAYyB3tBFoR2wAAAABJRU5ErkJggg==', // yellow
  unreadableFront: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8AARIQB46hC+ioEAGX8E/cKr6qsAAAAAElFTkSuQmCC', // red
  cdFront: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPj/n4EIwDiqkL4KAVIQE/f1/NxEAAAAAElFTkSuQmCC', // blue
  dvdFront: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAEklEQVR42mNoYGjAgxhGpbEhAJC6ZAEYInNtAAAAAElFTkSuQmCC', // purple
  generatedCover: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFElEQVR42mNk+A+ERADGUYX0VQgAXAYT9xTSUocAAAAASUVORK5CYII=', // green
};

/** File payload for setInputFiles, from one of the IMAGES constants. */
export function photo(name: string, base64: string) {
  return {
    name,
    mimeType: 'image/png',
    buffer: Buffer.from(base64, 'base64'),
  };
}

export interface TestLoanItem {
  isbn?: string;
  mediaType: 'BOOK' | 'CD' | 'DVD';
  title: string;
  author?: string;
  library?: string;
  /** Omitted for the user's own items, which have no due date. */
  dueDate?: string;
  status?:
    | 'LOANED'
    | 'UNREAD'
    | 'READING'
    | 'READ'
    | 'READ_RETURNED'
    | 'UNREAD_RETURNED';
}

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function cleanupDb() {
  // Import jobs reference loan items, so they go first.
  await query('DELETE FROM library.import_jobs');
  await query('DELETE FROM library.loan_items');
  await query('DELETE FROM library.libraries');
}

export function cleanupStorage() {
  ['thumbnails', 'imports'].forEach((directory) =>
    fs.rmSync(path.join(STORAGE_DIR, directory), {
      recursive: true,
      force: true,
    })
  );
}

/** Arms the mock OpenAI server for the current test. */
export async function configureMockOpenAI(
  config: {
    delayMs?: number;
    failWith?: { status: number; count: number; retryAfter?: number };
  } = {}
) {
  await fetch('http://localhost:3070/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export function thumbnailPath(isbn: string): string {
  return path.join(STORAGE_DIR, 'thumbnails', `${isbn}.jpg`);
}

export function writeThumbnail(isbn: string, image: Buffer) {
  fs.mkdirSync(path.join(STORAGE_DIR, 'thumbnails'), { recursive: true });
  fs.writeFileSync(thumbnailPath(isbn), image);
}

export function readThumbnail(isbn: string): Buffer | null {
  return fs.existsSync(thumbnailPath(isbn))
    ? fs.readFileSync(thumbnailPath(isbn))
    : null;
}

export async function insertLoanItem(item: TestLoanItem) {
  await query(
    `INSERT INTO library.loan_items
       (isbn, media_type, title, author, library, due_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      item.isbn ?? null,
      item.mediaType,
      item.title,
      item.author ?? null,
      item.library ?? null,
      item.dueDate ?? null,
      item.status ?? 'LOANED',
    ]
  );
}

/** Seeds the predefined library list the import page picks from. */
export async function insertLibrary(name: string) {
  await query(
    'INSERT INTO library.libraries (id, name) VALUES ($1, $2)',
    [name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name]
  );
}

export async function getLoanItems() {
  const result = await query(
    `SELECT *, to_char(due_date, 'YYYY-MM-DD') AS due_date_iso
     FROM library.loan_items ORDER BY title`
  );
  return result.rows;
}

export async function getImportJobs() {
  const result = await query(
    'SELECT * FROM library.import_jobs ORDER BY created_at'
  );
  return result.rows;
}

/** Date only (yyyy-mm-dd) relative to today, for stable due-date scenarios. */
export function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
