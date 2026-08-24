import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpContextToken,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { TokenService } from '../Services/token.service';

const LOGIN_PATH = '/token/';
const REFRESH_PATH = '/token/refresh/';

/**
 * Token de contexto (en memoria) que marca una request como reintento de refresh.
 * Al viajar en el objeto HttpRequest (no como header HTTP), NO dispara preflight
 * CORS ni consume Access-Control-Allow-Headers, evitando que el reintento se
 * bloquee por la política de Cross-Origin del backend Django.
 */
const RETRY_CONTEXT = new HttpContextToken<boolean>(() => false);

/**
 * Interceptor HTTP:
 *
 * 1. Adjunta el token de acceso (Bearer) a cada request autenticado.
 * 2. Si una request autenticada responde 401, intenta renovar el access token
 *    con el refresh y reintenta la request UNA vez. Si la renovación falla,
 *    limpia la sesión y redirige a /autenticacion.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private refreshing = false;

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const access = this.tokenService.getAccess();

    let authReq = req;
    if (access && !req.url.includes(LOGIN_PATH) && !req.url.includes(REFRESH_PATH)) {
      authReq = req.clone({ setHeaders: { Authorization: `Bearer ${access}` } });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (
          error.status === 401 &&
          !authReq.url.includes(LOGIN_PATH) &&
          !authReq.url.includes(REFRESH_PATH) &&
          !authReq.context.get(RETRY_CONTEXT)
        ) {
          return this.tryRefresh(authReq, next);
        }
        return throwError(() => error);
      }),
    );
  }

  private tryRefresh(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const refresh = this.tokenService.getRefresh();
    if (!refresh) {
      this.handleSessionExpired();
      return throwError(() => new Error('Sesión no válida'));
    }

    const refreshCall = this.http.post<{ access: string; refresh?: string }>(`${environment.apiUrl}${REFRESH_PATH}`, {
      refresh,
    });

    if (this.refreshing) {
      return this.refreshCalledOnce(req, next);
    }

    this.refreshing = true;
    return refreshCall.pipe(
      concatMap((tokens) => {
        this.refreshing = false;
        if (!tokens || !tokens.access) {
          this.handleSessionExpired();
          return throwError(() => new Error('No se pudo renovar la sesión'));
        }
        this.tokenService.saveTokens(tokens.access, tokens.refresh ?? refresh);
        const retry = req.clone({
          context: req.context.set(RETRY_CONTEXT, true),
          setHeaders: { Authorization: `Bearer ${tokens.access}` },
        });
        return next.handle(retry);
      }),
      catchError((refreshError) => {
        this.refreshing = false;
        this.handleSessionExpired();
        return throwError(() => refreshError);
      }),
    );
  }

  private refreshCalledOnce(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const access = this.tokenService.getAccess();
    if (access) {
      const retry = req.clone({
        context: req.context.set(RETRY_CONTEXT, true),
        setHeaders: { Authorization: `Bearer ${access}` },
      });
      return next.handle(retry);
    }
    this.handleSessionExpired();
    return throwError(() => new Error('Sesión no válida'));
  }

  private handleSessionExpired(): void {
    // clear() emite sessionCleared$, y AuthService (suscrito) limpia su estado
    // en memoria (currentUser y timer). No inyectamos AuthService aquí para
    // evitar el ciclo AuthService → HttpClient → interceptor → AuthService.
    this.tokenService.clear();
    this.router.navigate(['/autenticacion']);
  }
}
