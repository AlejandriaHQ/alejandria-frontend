import { Injectable, Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoanService } from './loan.service';

export type UserRole = 'admin' | 'user';

interface StoredSession {
  identifier: string;
  role: UserRole;
  expiresAt: number;
  originalUser?: {
    identifier: string;
    role: UserRole;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly sessionKey = 'alejandria_sesion';

  private currentUser: {
    identifier: string;
    role: UserRole;
  } | null = null;

  private timer: any;

  private originalUser: {
    identifier: string;
    role: UserRole;
  } | null = null;

  // La sesión expira a las 8 horas (jornada de la biblioteca)
  private inactivityTime = 8 * 60 * 60 * 1000;

  private readonly router = inject(Router);

  // LoanService se resuelve de forma perezosa: LoanService ya inyecta AuthService,
  // por lo que inyectarlo aquí directamente crearía una dependencia circular.
  private readonly injector = inject(Injector);

  constructor() {
    this.restoreSession();
  }

  login(identifier: string, password: string): UserRole | null {
    if (!identifier || !password) {
      return null;
    }

    // Usuarios persistidos en alejandria_users: se valida por correo o identificador
    // más contraseña, y el rol sale del propio usuario guardado.
    const savedUser = this.injector
      .get(LoanService)
      .getUsers()
      .find(
        (user) =>
          user.password === password &&
          (user.email.toLowerCase() === identifier.toLowerCase() || user.identifier === identifier),
      );

    if (savedUser) {
      // RN-08: un usuario desactivado no puede volver a iniciar sesión.
      if (savedUser.status === 'inactive') {
        return null;
      }

      this.currentUser = {
        identifier: savedUser.identifier,
        role: savedUser.role,
      };

      this.saveSession();
      this.startTimer();

      return savedUser.role;
    }

    // Administrador (respaldo de la demo; coincide con la semilla ADM-2026-0001)
    if (identifier === 'admin@alejandria.com' && password === 'admin123') {
      this.currentUser = {
        identifier,
        role: 'admin',
      };

      this.saveSession();
      this.startTimer();

      return 'admin';
    }

    // Usuario demo (respaldo; la sesión guarda el identificador unificado MEM-2026-0001)
    if (identifier === 'usuario001' && password === 'usuario123') {
      this.currentUser = {
        identifier: 'MEM-2026-0001',
        role: 'user',
      };

      this.saveSession();
      this.startTimer();

      return 'user';
    }

    return null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  get inUserView(): boolean {
    return this.originalUser !== null;
  }

  // Solo administradores: entrar a la vista de usuario para probar la app

  enterUserView() {
    const user = this.getCurrentUser();

    if (!user || user.role !== 'admin' || this.inUserView) {
      return;
    }

    this.originalUser = user;

    this.currentUser = {
      identifier: 'MEM-2026-0001',
      role: 'user',
    };

    this.saveSession();
    this.startTimer();

    this.router.navigate(['/usuario']);
  }

  exitUserView() {
    if (!this.inUserView) {
      return;
    }

    this.currentUser = this.originalUser;

    this.originalUser = null;

    this.saveSession();
    this.startTimer();

    this.router.navigate(['/admin']);
  }

  logout() {
    this.currentUser = null;

    this.originalUser = null;

    this.clearStoredSession();
    this.stopTimer();

    this.router.navigate(['/autenticacion']);
  }

  private saveSession() {
    const session: StoredSession = {
      identifier: this.currentUser!.identifier,
      role: this.currentUser!.role,
      expiresAt: Date.now() + this.inactivityTime,
      originalUser: this.originalUser,
    };

    localStorage.setItem(this.sessionKey, JSON.stringify(session));
  }

  private restoreSession() {
    const stored = localStorage.getItem(this.sessionKey);

    if (!stored) {
      return;
    }

    try {
      const session: StoredSession = JSON.parse(stored);

      const remaining = session.expiresAt - Date.now();

      if (remaining <= 0) {
        this.clearStoredSession();

        return;
      }

      this.currentUser = {
        identifier: session.identifier,
        role: session.role,
      };

      this.originalUser = session.originalUser ?? null;

      this.timer = setTimeout(() => this.expireSession(), remaining);
    } catch {
      this.clearStoredSession();
    }
  }

  private startTimer() {
    this.stopTimer();

    this.timer = setTimeout(() => this.expireSession(), this.inactivityTime);
  }

  private expireSession() {
    this.currentUser = null;

    this.timer = null;

    this.clearStoredSession();

    console.log('Sesión expirada por inactividad');

    this.router.navigate(['/autenticacion']);
  }

  private clearStoredSession() {
    localStorage.removeItem(this.sessionKey);
  }

  private stopTimer() {
    if (this.timer) {
      clearTimeout(this.timer);

      this.timer = null;
    }
  }
}
