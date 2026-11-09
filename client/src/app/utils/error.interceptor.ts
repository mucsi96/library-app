import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { catchError } from 'rxjs';

export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(
  () => false
);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationsService);
  return next(req).pipe(
    catchError((error) => {
      if (!req.context.get(SKIP_ERROR_NOTIFICATION)) {
        notifications.error('An error occurred. ' + error.message);
      }
      return Promise.reject(error);
    })
  );
};
