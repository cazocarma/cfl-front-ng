import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { AuthnService } from '../services/authn.service';

/**
 * Intercepta errores de red y HTTP globales:
 * - status 0: sin conexión al servidor
 * - 401: sesión expirada → logout automático
 * - 403: sin permisos
 * - 5xx: error interno
 */
export const networkErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthnService);

  return next(req).pipe(
    catchError((err) => {
      const status = err?.status ?? 0;

      if (status === 0) {
        toast.show(
          'Sin conexion al servidor. Revisa tu red o intenta en unos momentos.',
          true,
          8000,
        );
      } else if (status === 401 && !req.url.includes('/authn/login')) {
        toast.show('Sesion expirada. Por favor, vuelve a iniciar sesion.', true, 5000);
        auth.logout();
      } else if (status === 403) {
        toast.show('No cuentas con los permisos necesarios para esta accion.', true, 5000);
      } else if (status >= 500) {
        toast.show(
          'Ocurrio un problema en el servidor. Intenta nuevamente en unos momentos.',
          true,
          6000,
        );
      }

      return throwError(() => err);
    }),
  );
};
