import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Gestión del par de tokens JWT emitido por SimpleJWT (backend Django).
 *
 * - access  : token de corta vida (60 min según settings.SIMPLE_JWT).
 * - refresh : token de larga vida (1 día) para renovar el access.
 *
 * Guarda ambos en localStorage. También conserva los claims útiles para la
 * sesión (role e identifier) que el backend inyecta en el payload del token.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly accessKey = 'alejandria_access';
  private readonly refreshKey = 'alejandria_refresh';
  private readonly claimsKey = 'alejandria_claims';

  // Notifica que la sesión se borró (p.ej. expiración de tokens en el interceptor).
  // AuthService se suscribe para limpiar su estado en memoria sin crear un ciclo
  // de inyección (el interceptor solo depende de este servicio).
  private readonly sessionClearedSubject = new Subject<void>();

  /** Observable que emite cada vez que `clear()` elimina tokens y claims. */
  readonly sessionCleared$ = this.sessionClearedSubject.asObservable();

  saveTokens(access: string, refresh: string): void {
    localStorage.setItem(this.accessKey, access);
    localStorage.setItem(this.refreshKey, refresh);
  }

  getAccess(): string | null {
    return localStorage.getItem(this.accessKey);
  }

  getRefresh(): string | null {
    return localStorage.getItem(this.refreshKey);
  }

  /** Persiste los claims del access token (role, identifier). */
  saveClaims(claims: TokenClaims | null): void {
    if (claims) {
      localStorage.setItem(this.claimsKey, JSON.stringify(claims));
    } else {
      localStorage.removeItem(this.claimsKey);
    }
  }

  getClaims(): TokenClaims | null {
    const stored = localStorage.getItem(this.claimsKey);
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(this.accessKey);
    localStorage.removeItem(this.refreshKey);
    localStorage.removeItem(this.claimsKey);
    this.sessionClearedSubject.next();
  }
}

export interface TokenClaims {
  user_id: number;
  role: 'admin' | 'user';
  identifier: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}
