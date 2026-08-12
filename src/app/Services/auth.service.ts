import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

export type UserRole = 'admin' | 'user';

interface StoredSession {
  identifier: string;
  role: UserRole;
  expiresAt: number;
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

  // La sesión expira a los 30 minutos (RF-03)
  private inactivityTime = 30 * 60 * 1000;

  constructor(private router: Router) {
    this.restoreSession();
  }

  login(identifier: string, password: string): UserRole | null {
    if (!identifier || !password) {
      return null;
    }

    // Administrador
    if (identifier === 'admin@alejandria.com' && password === 'admin123') {
      this.currentUser = {
        identifier,
        role: 'admin',
      };

      this.saveSession();
      this.startTimer();

      return 'admin';
    }

    // Usuario
    if (identifier === 'usuario001' && password === 'usuario123') {
      this.currentUser = {
        identifier,
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

  logout() {
    this.currentUser = null;

    this.clearStoredSession();
    this.stopTimer();

    this.router.navigate(['/autenticacion']);
  }

  private saveSession() {
    const session: StoredSession = {
      identifier: this.currentUser!.identifier,
      role: this.currentUser!.role,
      expiresAt: Date.now() + this.inactivityTime,
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
