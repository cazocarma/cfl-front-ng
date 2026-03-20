import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

/**
 * Intercepta errores de red (status 0 = sin conexión al servidor) y
 * muestra un toast global amigable. Deja pasar el error para que los
 * componentes puedan seguir manejándolo si lo necesitan.
 */
export const networkErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err) => {
      const status = err?.status ?? 0;

      if (status === 0) {
        toast.show(
          'No se pudo conectar al servidor. Verifica que el backend esté en ejecución.',
          true,
          8000,
        );
      } else if (status >= 500) {
        toast.show(
          `Error interno del servidor (${status}). Intenta nuevamente en unos momentos.`,
          true,
          6000,
        );
      }

      return throwError(() => err);
    }),
  );
};
