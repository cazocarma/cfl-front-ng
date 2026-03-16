import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthnService } from '../services/authn.service';

/**
 * Adjunta el token JWT a cada petición HTTP saliente.
 * También envía x-cfl-role para compatibilidad con el middleware legacy de authz.js.
 */
export const authnInterceptor: HttpInterceptorFn = (req, next) => {
  const authnService = inject(AuthnService);
  const token = authnService.getToken();

  if (!token) return next(req);

  const user = authnService.getCurrentUser();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (user?.role) {
    headers['x-cfl-role'] = user.role;
  }

  return next(req.clone({ setHeaders: headers }));
};
