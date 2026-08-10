import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export async function fetchJson<T>(
  http: HttpClient,
  url: string,
  options: {
    body?: any;
    method?: string;
    headers?: Record<string, string>;
    context?: HttpContext;
  } = {}
) {
  const { body, method = 'get', headers: extraHeaders = {}, context } = options;
  const response = await firstValueFrom(
    http.request(method, url, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...extraHeaders,
      }),
      body,
      context,
      responseType: 'json',
    })
  );
  return response as T;
}
