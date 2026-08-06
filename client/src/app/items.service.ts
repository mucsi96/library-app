import { HttpClient } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import {
  ImportLoanItem,
  ImportResult,
  LoanItem,
  ParsedLoanItem,
} from './loan-item';
import { fetchBookMetadata } from './utils/book-metadata';
import { fetchJson } from './utils/fetchJson';

@Injectable({
  providedIn: 'root',
})
export class ItemsService {
  private readonly http = inject(HttpClient);

  items = resource<LoanItem[], {}>({
    loader: () => fetchJson<LoanItem[]>(this.http, '/api/items'),
  });

  async setCompleted(id: number, completed: boolean): Promise<void> {
    await fetchJson<LoanItem>(this.http, `/api/items/${id}/completed`, {
      method: 'put',
      body: { completed },
    });
    this.items.reload();
  }

  async importItems(items: ParsedLoanItem[]): Promise<ImportResult> {
    const enriched = await Promise.all(items.map((item) => this.enrich(item)));
    const result = await fetchJson<ImportResult>(
      this.http,
      '/api/items/import',
      {
        method: 'post',
        body: enriched,
      }
    );
    this.items.reload();
    return result;
  }

  /**
   * Pulls ISBN and cover thumbnail from Google Books. Metadata already
   * stored for the item's barcode is reused instead of a new lookup.
   */
  private async enrich(item: ParsedLoanItem): Promise<ImportLoanItem> {
    const existing = (this.items.value() ?? []).find(
      ({ barcode }) => barcode === item.barcode
    );

    if (existing?.isbn && existing.thumbnailUrl) {
      return {
        ...item,
        isbn: existing.isbn,
        thumbnailUrl: existing.thumbnailUrl,
      };
    }

    return {
      ...item,
      ...(await fetchBookMetadata(item, existing?.isbn ?? null)),
    };
  }
}
