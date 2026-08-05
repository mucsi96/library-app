import { HttpClient } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import { ImportResult, LoanItem, ParsedLoanItem } from './loan-item';
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
    const result = await fetchJson<ImportResult>(
      this.http,
      '/api/items/import',
      {
        method: 'post',
        body: items,
      }
    );
    this.items.reload();
    return result;
  }
}
