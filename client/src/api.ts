import { z } from 'zod';

export const mediaTypeSchema = z.enum(['BOOK', 'CD', 'DVD']);
export const statusSchema = z.enum(['LOANED', 'NOT_STARTED', 'READING', 'READ', 'READ_RETURNED', 'UNREAD_RETURNED']);
export const itemSchema = z.object({
  id: z.number().int(), isbn: z.string().nullable(), mediaType: mediaTypeSchema,
  title: z.string(), author: z.string().nullable(), library: z.string().nullable(),
  dueDate: z.iso.date().nullable(), status: statusSchema,
});
export const librarySchema = z.object({ id: z.string(), name: z.string() });
export const jobSchema = z.object({
  reference: z.uuid(), status: z.enum(['QUEUED', 'EXTRACTING', 'NEEDS_ISBN', 'GENERATING_COVER', 'COMPLETED', 'FAILED']),
  isbn: z.string().nullable(), title: z.string().nullable(), author: z.string().nullable(),
  mediaType: mediaTypeSchema.nullable(), library: z.string().nullable(), itemId: z.number().int().nullable(),
  errorDetail: z.string().nullable(), createdAt: z.string(),
});
export const userSchema = z.object({
  email: z.string(), preferredUsername: z.string().optional(),
  additionalClaims: z.object({ name: z.string().optional() }).optional(),
});
export type LoanItem = z.infer<typeof itemSchema>;
export type LoanStatus = z.infer<typeof statusSchema>;
export type MediaType = z.infer<typeof mediaTypeSchema>;
export type ImportJob = z.infer<typeof jobSchema>;

let redirecting = false;
function sessionExpired(status: number) {
  if (status !== 401 || redirecting) return;
  redirecting = true;
  const { pathname, search, hash } = window.location;
  window.location.assign(`/oauth2/start?rd=${encodeURIComponent(pathname + search + hash)}`);
}

function requestHeaders(method: string, initial?: HeadersInit) {
  const headers = new Headers(initial);
  headers.set('Accept', 'application/json');
  headers.set('X-Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase())) {
    const cookie = document.cookie.split(';').map(value => value.trim())
      .find(value => value.startsWith('__Host-XSRF-TOKEN='));
    if (!cookie) throw new Error('Missing CSRF token. Reload the page and try again.');
    headers.set('X-XSRF-TOKEN', decodeURIComponent(cookie.slice('__Host-XSRF-TOKEN='.length)));
  }
  return headers;
}

function responseError(status: number, body: unknown): Error {
  sessionExpired(status);
  const problem = z.object({ detail: z.string() }).safeParse(body);
  return new Error(problem.success ? problem.data.detail : `Request failed (${status}). Please try again.`);
}

export async function fetchJson<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error('API requests must be same-origin');
  const response = await fetch(url, {
    ...init, headers: requestHeaders(init.method ?? 'GET', init.headers), credentials: 'same-origin',
  });
  if (!response.ok) throw responseError(response.status, await response.json().catch(() => null));
  return schema.parse(response.status === 204 ? undefined : await response.json());
}

export function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Fetch does not expose upload progress. XHR is limited to the photo upload;
// credentials, CSRF and session expiry follow the same gateway contract.
export function uploadPhotos(front: File, back: File, library: string | null, onProgress: (value: number) => void): Promise<ImportJob> {
  const headers = requestHeaders('POST');
  const body = new FormData();
  body.append('front', front);
  body.append('back', back);
  if (library !== null) body.append('library', library);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/items/import');
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Please try again.'));
    xhr.onload = () => {
      const result: unknown = (() => { try { return JSON.parse(xhr.responseText); } catch { return null; } })();
      if (xhr.status < 200 || xhr.status >= 300) { reject(responseError(xhr.status, result)); return; }
      const job = jobSchema.safeParse(result);
      if (job.success) resolve(job.data); else reject(job.error);
    };
    xhr.send(body);
  });
}
