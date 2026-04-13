import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthzService } from '../services/authz.service';

/**
 * Factory que crea un guard basado en permisos. Permite acceso solo si el
 * usuario autenticado tiene al menos uno de los permisos indicados (OR).
 *
 * Espera a que el contexto de autorizacion este cargado antes de evaluar.
 * Esto previene falsos negativos al refrescar la pagina (F5).
 *
 * Uso en routes:
 *   canActivate: [authnGuard, permissionGuard('facturas.editar')]
 *   canActivate: [authnGuard, permissionGuard('planillas.ver', 'planillas.generar')]
 */
export function permissionGuard(...requiredPermissions: string[]): CanActivateFn {
  return async () => {
    const authz = inject(AuthzService);
    const router = inject(Router);

    await authz.ensureLoaded();

    if (authz.hasAnyPermission(...requiredPermissions)) {
      return true;
    }

    router.navigate(['/bandeja']);
    return false;
  };
}
