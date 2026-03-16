import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthnService } from '../services/authn.service';

export const authnGuard: CanActivateFn = () => {
  const authnService = inject(AuthnService);
  const router = inject(Router);

  if (authnService.isLoggedIn()) return true;

  router.navigate(['/login']);
  return false;
};
