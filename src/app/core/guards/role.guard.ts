import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthnService } from '../services/authn.service';

/**
 * Factory que crea un guard de rol. Permite acceso solo si el usuario
 * autenticado tiene uno de los roles indicados.
 *
 * Uso en routes:
 *   canActivate: [authnGuard, roleGuard('administrador')]
 *   canActivate: [authnGuard, roleGuard('administrador', 'autorizador')]
 */
export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return () => {
    const authnService = inject(AuthnService);
    const router = inject(Router);

    const user = authnService.getCurrentUser();
    if (user?.role && allowedRoles.includes(user.role.toLowerCase())) {
      return true;
    }

    router.navigate(['/bandeja']);
    return false;
  };
}
