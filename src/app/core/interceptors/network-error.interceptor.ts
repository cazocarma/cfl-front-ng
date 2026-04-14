import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthnService } from '../services/authn.service';
import { ToastService } from '../services/toast.service';

/**
 * Intercepta errores de red y HTTP globales:
 *   - status 0 → sin conexión al servidor.
 *   - 401 (no login ni logout) → sesión inválida: logout + redirect.
 *   - 403 → permiso insuficiente: toast informativo.
 *   - 5xx → error del servidor.
 *
 * El 401 es el único que fuerza logout (que a su vez limpia token y resetea
 * AuthzService). El 403 no: puede ser una acción puntual que el rol no
 * autoriza; no invalida la sesión.
 */
export const networkErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthnService);

  const isAuthLoginOrLogout =
    req.url.includes('/api/authn/login') || req.url.includes('/api/authn/logout');

  return next(req).pipe(
    catchError((err) => {
      const status = err?.status ?? 0;

      if (status === 0) {
        toast.show(
          'Sin conexión al servidor. Revisa tu red o intenta en unos momentos.',
          true,
          8000,
        );
      } else if (status === 401 && !isAuthLoginOrLogout) {
        toast.show('Tu sesión expiró. Inicia sesión nuevamente.', true, 5000);
        auth.logout();
      } else if (status === 403 && !isAuthLoginOrLogout) {
        toast.show('No cuentas con los permisos necesarios para esta acción.', true, 5000);
      } else if (status >= 500) {
        toast.show(
          'Ocurrió un problema en el servidor. Intenta nuevamente en unos momentos.',
          true,
          6000,
        );
      }

      return throwError(() => err);
    }),
  );
};
