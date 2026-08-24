import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Envoltorio de la API del backend Django.
 *
 * El backend responde SIEMPRE con un envelope:
 *   { "success": boolean, "Mensaje": string|string[]|object, "datos": ... }
 *
 * Este servicio normaliza:
 * - Extrae `datos` cuando `success` es true.
 * - Convierte `success: false` en un Error que propaga el `Mensaje` del backend
 *   (que puede ser un string, un array de errores o un objeto campo->error).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = environment.apiUrl;

  get<T = unknown>(path: string, params?: Record<string, string | number>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
    return this.http
      .get<ApiEnvelope<T>>(this.url(path), { params: httpParams })
      .pipe(
        map((e) => this.unwrap(e)),
        catchError((err) => this.handleHttpError(err))
      );
  }

  post<T = unknown>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(this.url(path), body)
      .pipe(
        map((e) => this.unwrap(e)),
        catchError((err) => this.handleHttpError(err))
      );
  }

  put<T = unknown>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<ApiEnvelope<T>>(this.url(path), body)
      .pipe(
        map((e) => this.unwrap(e)),
        catchError((err) => this.handleHttpError(err))
      );
  }

  delete<T = unknown>(path: string): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(this.url(path))
      .pipe(
        map((e) => this.unwrap(e)),
        catchError((err) => this.handleHttpError(err))
      );
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /**
   * Extrae `datos` del envelope. Si `success` es false, lanza un Error con el
   * `Mensaje` del backend, normalizado a texto cuando es un array/objeto.
   */
  private unwrap<T>(envelope: ApiEnvelope<T>): T {
    if (!envelope || envelope.success === false) {
      throw new Error(this.messageToText(envelope?.Mensaje));
    }
    return (envelope.datos ?? (null as unknown as T));
  }

  /**
   * Normaliza errores HTTP (4xx/5xx). Angular los emite como `HttpErrorResponse`
   * y, al no pasar por `unwrap`, el `Mensaje` del envelope se perdía. Aquí se
   * extrae el `Mensaje` del body (envelope) y se lanza un Error con texto
   * legible; si no hay `Mensaje`, se usa un mensaje genérico según el status.
   */
  private handleHttpError(err: HttpErrorResponse): Observable<never> {
    console.error('[ApiService] Error HTTP', err);
    const message = this.extractHttpErrorMessage(err.error, err.status);
    return throwError(() => new Error(message));
  }

  private extractHttpErrorMessage(body: unknown, status: number): string {
    // El body es el envelope (o un objeto con success/Mensaje), pero a veces
    // el backend responde texto plano: se usa como mensaje directo.
    const envelope = (body ?? {}) as Partial<ApiEnvelope<unknown>>;
    if (envelope.Mensaje !== undefined && envelope.Mensaje !== null) {
      return this.messageToText(envelope.Mensaje);
    }
    if (typeof body === 'string' && body.length > 0) {
      return body;
    }
    return this.genericHttpStatusMessage(status);
  }

  private genericHttpStatusMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'Solicitud inválida',
      401: 'Sesión no válida',
      403: 'No tiene permisos para realizar esta acción',
      404: 'Recurso no encontrado',
      500: 'Error interno del servidor',
    };
    return messages[status] ?? 'Ocurrió un error inesperado';
  }

  private messageToText(message: unknown): string {
    if (message === undefined || message === null) {
      return 'Ocurrió un error inesperado';
    }
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join('\n');
    }
    if (typeof message === 'object') {
      const entries = Object.entries(message as Record<string, unknown>);
      return entries
        .map(([field, value]) => {
          if (Array.isArray(value)) {
            return `${field}: ${value.join(', ')}`;
          }
          return `${field}: ${String(value)}`;
        })
        .join('\n');
    }
    return String(message);
  }
}

export interface ApiEnvelope<T> {
  success: boolean;
  Mensaje?: string | string[] | Record<string, unknown>;
  datos?: T | null;
  /** Campos de paginación (en endpoints .../paginar). */
  maxPages?: number;
  currentpage?: number;
  previous?: boolean;
  next?: boolean;
}
