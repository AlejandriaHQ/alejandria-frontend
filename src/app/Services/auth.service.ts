import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenService } from './token.service';
import { decodeJwtPayload } from '../utils/jwt.helper';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  identifier: string;
  role: UserRole;
}

/**
 * Servicio de autenticación contra el backend Django (SimpleJWT).
 *
 * - `login()` llama a `POST /token/` con `{email, password}` (acepta email,
 *   identifier o username como credencial) y guarda el par access/refresh.
 * - Los claims `role` e `identifier` viajan en el payload del access token y
 *   se persisten para que el guard y las páginas resuelvan la sesión en
 *   sincronía.
 * - `logout()` limpia tokens, claims y redirige a /autenticacion.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  private currentUser: AuthUser | null = null;

  // Límite de sesión de trabajo (jornada de la biblioteca): 8 horas.
  private readonly inactivityTime = 8 * 60 * 60 * 1000;

  private inactivityTimer: any;

  constructor() {
    // Reacciona a cualquier borrado de tokens (p.ej. 401 de refresh fallido en
    // el interceptor) para limpiar el estado en memoria. Esto evita el ciclo de
    // inyección AuthService → HttpClient → interceptor → AuthService: el
    // interceptor solo usa TokenService, y AuthService se entera vía observable.
    this.tokenService.sessionCleared$.subscribe(() => this.resetSessionState());
    this.restoreSession();
  }

  /**
   * Inicia sesión contra el backend.
   *
   * @returns Observable con las credenciales de sesión (identifier y role).
   */
  login(identifier: string, password: string): Observable<AuthUser> {
    return this.http
      .post<{ access: string; refresh: string }>(`${environment.apiUrl}/token/`, {
        email: identifier,
        password,
      })
      .pipe(
        map((tokens) => {
          const user = this.applyTokens(tokens.access, tokens.refresh);
          if (!user) {
            throw new Error('Respuesta de autenticación inválida');
          }
          return user;
        }),
      );
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /** Verifica si hay una sesión válida (access no expirado o refresh disponible). */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  get inUserView(): boolean {
    return this.originalUserBackup !== null;
  }

  private originalUserBackup: AuthUser | null = null;

  // Solo administradores: entrar a la vista de usuario para probar la app.
  enterUserView(): void {
    const user = this.getCurrentUser();
    if (!user || user.role !== 'admin' || this.inUserView) {
      return;
    }
    this.originalUserBackup = user;
    this.currentUser = { identifier: 'MEM-2026-0001', role: 'user' };
    this.startInactivityTimer();
    this.router.navigate(['/usuario']);
  }

  exitUserView(): void {
    if (!this.inUserView) {
      return;
    }
    this.currentUser = this.originalUserBackup;
    this.originalUserBackup = null;
    this.startInactivityTimer();
    this.router.navigate(['/admin']);
  }

  logout(): void {
    this.resetSessionState();
    this.tokenService.clear(); // emite sessionCleared$ → resetSessionState (idempotente)
    this.router.navigate(['/autenticacion']);
  }

  /**
   * Limpia solo el estado en memoria (usuario, backup y timer) sin tocar
   * tokens ni navegar. Lo usa logout() y la suscripción a sessionCleared$.
   */
  private resetSessionState(): void {
    this.currentUser = null;
    this.originalUserBackup = null;
    this.stopInactivityTimer();
  }

  private applyTokens(access: string, refresh: string): AuthUser | null {
    this.tokenService.saveTokens(access, refresh);

    const payload = decodeJwtPayload(access);
    const role = payload?.['role'] as UserRole | undefined;
    const identifier = payload?.['identifier'] as string | undefined;
    const userId = payload?.['user_id'] as number | undefined;

    if (role && identifier) {
      this.tokenService.saveClaims({ user_id: userId ?? 0, role, identifier });
      this.currentUser = { identifier, role };
      this.startInactivityTimer();
      return this.currentUser;
    }
    return null;
  }

  private restoreSession(): void {
    const claims = this.tokenService.getClaims();
    const access = this.tokenService.getAccess();

    if (!claims) {
      this.currentUser = null;
      return;
    }

    const payload = access ? decodeJwtPayload(access) : null;
    const exp = payload?.['exp'] as number | undefined;

    const accessValid = !!exp && exp * 1000 > Date.now();

    // Sesión válida si el access no expiró, o si hay refresh para renovarlo.
    if (accessValid || this.tokenService.getRefresh()) {
      this.currentUser = { identifier: claims.identifier, role: claims.role };
      this.startInactivityTimer();
    } else {
      this.tokenService.clear();
      this.currentUser = null;
    }
  }

  private startInactivityTimer(): void {
    this.stopInactivityTimer();
    this.inactivityTimer = setTimeout(() => this.logout(), this.inactivityTime);
  }

  private stopInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
}
