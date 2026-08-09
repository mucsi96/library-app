import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LoanItem, LoanStatus } from './loan-item';
import { SKIP_ERROR_NOTIFICATION } from './utils/error.interceptor';
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

  /**
   * Imports one borrowed item from photos of its front and back. The
   * server extracts and validates the ISBN and generates a cover
   * thumbnail with library markings removed.
   */
  async importItem(front: File, back: File): Promise<LoanItem> {
    const photos = new FormData();
    photos.append('front', front);
    photos.append('back', back);
    // Import failures surface inline on the import page instead of as a
    // global notification.
    const item = await firstValueFrom(
      this.http.post<LoanItem>('/api/items/import', photos, {
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
    );
    this.items.reload();
    return item;
  }
}
