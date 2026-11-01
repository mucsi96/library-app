import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, NEVER, throwError } from 'rxjs';

let redirecting = false;

/** Re-enter document authentication when the gateway session expires. Never replay mutations. */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => next(req).pipe(
  catchError((error: unknown) => {
    const url = new URL(req.url, window.location.origin);
    if (error instanceof HttpErrorResponse && error.status === 401 &&
        url.origin === window.location.origin &&
        (url.pathname.startsWith('/api/') || url.pathname === '/oauth2/userinfo')) {
      if (!redirecting) {
        redirecting = true;
        const returnTo = window.location.pathname + window.location.search;
        window.location.assign(`/oauth2/start?rd=${encodeURIComponent(returnTo)}`);
      }
      return NEVER;
    }
    return throwError(() => error);
  })
);
