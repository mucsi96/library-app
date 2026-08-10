import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import { Library } from './library';
import { SKIP_ERROR_NOTIFICATION } from './utils/error.interceptor';
import { fetchJson } from './utils/fetchJson';

@Injectable({
  providedIn: 'root',
})
export class LibrariesService {
  private readonly http = inject(HttpClient);

  readonly libraries = resource<Library[], {}>({
    loader: () => fetchJson<Library[]>(this.http, '/api/libraries'),
  });

  /** Failures (e.g. a duplicate name) surface inline on the settings page. */
  async add(name: string): Promise<void> {
    await fetchJson<Library>(this.http, '/api/libraries', {
      method: 'post',
      body: { name },
      context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
    });
    this.libraries.reload();
  }

  async remove(library: Library): Promise<void> {
    await fetchJson<void>(this.http, `/api/libraries/${library.id}`, {
      method: 'delete',
    });
    this.libraries.reload();
  }
}
