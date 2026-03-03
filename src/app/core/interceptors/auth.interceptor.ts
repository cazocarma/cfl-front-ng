import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Adjunta el token JWT a cada petición HTTP saliente.
 * También envía x-cfl-role para compatibilidad con el middleware legacy de authz.js.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (!token) return next(req);

  const user = auth.getCurrentUser();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (user?.role) {
    headers['x-cfl-role'] = user.role;
  }

  return next(req.clone({ setHeaders: headers }));
};
