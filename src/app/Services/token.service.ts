import { Injectable } from '@angular/core';

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
  }
}

export interface TokenClaims {
  user_id: number;
  role: 'admin' | 'user';
  identifier: string;
}
