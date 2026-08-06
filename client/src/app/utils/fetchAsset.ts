import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_NOTIFICATION } from './error.interceptor';

/**
 * Fetches a protected binary asset with the authenticated HttpClient and
 * exposes it as an object URL usable in an img src. A missing asset is
 * the caller's concern (placeholder), not worth a global notification.
 */
export async function fetchAsset(
  http: HttpClient,
  url: string
): Promise<string> {
  const blob = await firstValueFrom(
    http.get(url, {
      responseType: 'blob',
      context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
    })
  );
  return URL.createObjectURL(blob);
}
