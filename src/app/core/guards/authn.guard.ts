import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthnService } from '../services/authn.service';
import { AuthzService, AuthzContextError } from '../services/authz.service';
import { ToastService } from '../services/toast.service';

/**
 * Guard de autenticación: permite el acceso sólo si:
 *   1) Hay un JWT local válido en forma y aún no expirado, Y
 *   2) El backend reconoce el token y entrega contexto de autorización.
 *
 * El paso (2) es esencial: un JWT con firma correcta pero con usuario
 * desactivado/revocado NO debe habilitar acceso a rutas protegidas.
 *
 * Si alguno falla, el guard hace logout (limpia token + authz) y redirige a
 * /login con un toast apropiado.
 */
export const authnGuard: CanActivateFn = async () => {
  const authn = inject(AuthnService);
  const authz = inject(AuthzService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const hadToken = !!authn.getToken();

  if (!authn.isLoggedIn()) {
    toast.show(
      hadToken
        ? 'Tu sesión expiró. Inicia sesión nuevamente.'
        : 'Necesitas iniciar sesión para acceder a esta página.',
      true,
    );
    authn.logout();
    return router.parseUrl('/login');
  }

  try {
    await authz.ensureLoaded();
  } catch (err: unknown) {
    const status = err instanceof AuthzContextError ? err.status : 0;
    toast.show(
      status === 401
        ? 'Tu sesión expiró. Inicia sesión nuevamente.'
        : status === 403
        ? 'Tu cuenta no está activa o no tiene roles asignados.'
        : 'No se pudo validar tu sesión. Inicia sesión nuevamente.',
      true,
    );
    authn.logout();
    return router.parseUrl('/login');
  }

  return true;
};
