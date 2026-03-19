import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthnService } from '../services/authn.service';

/**
 * Adjunta el token JWT solo a peticiones dirigidas al propio backend.
 * URLs relativas (/api/...) o del mismo origen reciben el header; URLs externas no.
 */
export const authnInterceptor: HttpInterceptorFn = (req, next) => {
  const authnService = inject(AuthnService);
  const token = authnService.getToken();

  if (!token || !isSameOrigin(req.url)) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

function isSameOrigin(url: string): boolean {
  if (url.startsWith('/') || !url.startsWith('http')) return true;
  try {
    return new URL(url).origin === globalThis.location.origin;
  } catch {
    return false;
  }
}
