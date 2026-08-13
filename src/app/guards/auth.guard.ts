import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';

import { AuthService } from '../Services/auth.service';

export const authGuard: CanActivateFn = (route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();

  if (!user) {
    router.navigate(['/autenticacion']);

    return false;
  }

  const roles = route.data?.['roles'] as string[] | undefined;

  if (roles && !roles.includes(user.role)) {
    router.navigate([user.role === 'admin' ? '/admin' : '/usuario']);

    return false;
  }

  return true;
};
