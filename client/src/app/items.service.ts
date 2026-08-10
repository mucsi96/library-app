import { HttpClient } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import { LoanItem, LoanStatus } from './loan-item';
import { fetchJson } from './utils/fetchJson';

@Injectable({
  providedIn: 'root',
})
export class ItemsService {
  private readonly http = inject(HttpClient);

  items = resource<LoanItem[], {}>({
    loader: () => fetchJson<LoanItem[]>(this.http, '/api/items'),
  });

  async setStatus(id: number, status: LoanStatus): Promise<void> {
    await fetchJson<LoanItem>(this.http, `/api/items/${id}/status`, {
      method: 'put',
      body: { status },
    });
    this.items.reload();
  }

  /** Null moves the item to the user's own shelf. */
  async setLibrary(id: number, libraryId: string | null): Promise<void> {
    await fetchJson<LoanItem>(this.http, `/api/items/${id}/library`, {
      method: 'put',
      body: { library: libraryId },
    });
    this.items.reload();
  }
}
