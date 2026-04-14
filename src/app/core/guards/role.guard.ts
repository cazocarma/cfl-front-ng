import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthzService } from '../services/authz.service';
import { ToastService } from '../services/toast.service';

/**
 * Permite el acceso si el rol primario del usuario (fuente de verdad: BD, no
 * el JWT) está en la lista permitida.
 *
 * Se apoya en `AuthzService.primaryRole()` porque el JWT puede quedar
 * desincronizado con la BD tras cambios de rol o desactivaciones.
 */
export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  const normalized = allowedRoles.map((r) => r.toLowerCase());
  return async () => {
    const authz = inject(AuthzService);
    const router = inject(Router);
    const toast = inject(ToastService);

    await authz.ensureLoaded();

    const role = (authz.primaryRole() ?? '').toLowerCase();
    if (role && normalized.includes(role)) return true;

    toast.show('Tu rol no te permite acceder a esta página.', true);
    return router.parseUrl('/bandeja');
  };
}
