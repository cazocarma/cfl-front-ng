import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthnService } from '../services/authn.service';

export const guestGuard: CanActivateFn = () => {
  const authn = inject(AuthnService);
  const router = inject(Router);

  if (authn.isLoggedIn()) {
    router.navigate(['/bandeja']);
    return false;
  }
  return true;
};
