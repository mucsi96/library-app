import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5451,
  database: 'test',
  user: 'postgres',
  password: 'postgres',
});

export interface TestLoanItem {
  barcode: string;
  mediaType: 'BOOK' | 'CD';
  title: string;
  author?: string;
  category?: string;
  library: string;
  dueDate: string;
  note?: string;
  isbn?: string;
  thumbnailUrl?: string;
  completed?: boolean;
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
  await query('DELETE FROM library.loan_items');
}

export async function insertLoanItem(item: TestLoanItem) {
  await query(
    `INSERT INTO library.loan_items
       (barcode, media_type, title, author, category, library, due_date, note, isbn, thumbnail_url, completed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      item.barcode,
      item.mediaType,
      item.title,
      item.author ?? null,
      item.category ?? null,
      item.library,
      item.dueDate,
      item.note ?? null,
      item.isbn ?? null,
      item.thumbnailUrl ?? null,
      item.completed ?? false,
    ]
  );
}

export async function getLoanItems() {
  const result = await query(
    `SELECT *, to_char(due_date, 'YYYY-MM-DD') AS due_date_iso
     FROM library.loan_items ORDER BY barcode`
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
