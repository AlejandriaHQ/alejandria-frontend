import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';

import { AuthService } from '../Services/auth.service';

export const authGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.obtenerUsuarioActual()) {
    return true;
  }

  router.navigate(['/autenticacion']);
  return false;
};
