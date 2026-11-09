import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService, homeRouteFor } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  router.navigate(['/login']);
  return false;
};

export const redirectIfAuthedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    router.navigate([auth.homeRoute()]);
    return false;
  }
  return true;
};

/** Keeps technicians out of the owner/dispatcher area (/app/*). */
export const notTechnicianGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.activeMembership()?.role === 'TECHNICIAN') {
    router.navigate([homeRouteFor('TECHNICIAN')]);
    return false;
  }
  return true;
};
