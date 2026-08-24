import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
      .pipe(map((e) => this.unwrap(e)));
  }

  post<T = unknown>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(this.url(path), body)
      .pipe(map((e) => this.unwrap(e)));
  }

  put<T = unknown>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<ApiEnvelope<T>>(this.url(path), body)
      .pipe(map((e) => this.unwrap(e)));
  }

  delete<T = unknown>(path: string): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(this.url(path))
      .pipe(map((e) => this.unwrap(e)));
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
