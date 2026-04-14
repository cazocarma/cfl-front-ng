import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthzService } from '../services/authz.service';
import { ToastService } from '../services/toast.service';

/**
 * Permite el acceso si el usuario tiene al menos uno de los permisos indicados
 * (OR). Los admins pasan siempre.
 *
 * IMPORTANTE: debe ejecutarse DESPUÉS de `authnGuard` — asume que
 * `authz.ensureLoaded()` ya resolvió. Si no resolvió (rutas mal configuradas),
 * este guard igual lo espera para evitar falsos negativos al refrescar.
 */
export function permissionGuard(...requiredPermissions: string[]): CanActivateFn {
  return async () => {
    const authz = inject(AuthzService);
    const router = inject(Router);
    const toast = inject(ToastService);

    await authz.ensureLoaded();

    if (authz.isAdministrador() || authz.hasAnyPermission(...requiredPermissions)) {
      return true;
    }

    toast.show('No cuentas con los permisos necesarios para esta página.', true);
    return router.parseUrl('/bandeja');
  };
}
