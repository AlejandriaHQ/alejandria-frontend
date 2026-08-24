import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { User, UserRole } from '../models/usuario.model';

/**
 * DTO de usuario tal como lo devuelve el backend Django.
 *
 * El backend usa `id` (no `id_usuario`), y expone `first_name`/`last_name`
 * separados (el frontend trabaja con un único campo `name`). El `password`
 * es write_only: el backend NUNCA lo devuelve. `is_active` se lee (list/
 * retrieve/paginar) pero NO es editable por la API actual.
 */
interface UsuarioDTO {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  cedula?: string | null;
  address?: string | null;
  role?: string | null;
  identifier?: string | null;
  is_active?: boolean | null;
}

/**
 * Payload DTO para CREAR un usuario.
 *
 * El `identifier` es read_only (lo autogenera el modelo: ADM-<año>-<seq> /
 * MEM-<año>-<seq>), por lo que no se envía. El `password` es obligatorio.
 */
interface UsuarioCreatePayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: UserRole;
  cedula: string;
  phone?: string;
  address?: string;
}

/**
 * Payload DTO para ACTUALIZAR un usuario.
 *
 * `password` es OPCIONAL: si se envía se re-hashea, si no se conserva el hash
 * existente. El backend (UsuarioSerializerUpdate) tampoco expone `id` ni
 * `is_active` en la respuesta.
 */
interface UsuarioUpdatePayload {
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  cedula: string;
  phone?: string;
  address?: string;
  password?: string;
}

/** Envelope de un endpoint .../paginar con sus metadatos de paginación. */
interface PaginarEnvelope<T> {
  success: boolean;
  Mensaje?: unknown;
  datos?: T | null;
  maxPages?: number;
  currentpage?: number;
  previous?: boolean;
  next?: boolean;
}

/** Input para crear un usuario (forma del frontend, con `name` compuesto). */
export interface UsuarioCreateInput {
  name: string;
  email: string;
  role: UserRole;
  cedula: string;
  phone?: string;
  address?: string;
  password: string;
}

/** Input para actualizar un usuario. `password` es opcional (si se omite se conserva). */
export interface UsuarioUpdateInput {
  name: string;
  email: string;
  role: UserRole;
  cedula: string;
  phone?: string;
  address?: string;
  password?: string;
}

/** Resultado paginado de `searchUsers`. */
export interface UsuarioSearchResult {
  users: User[];
  currentPage: number;
  maxPages: number;
  previous: boolean;
  next: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  private readonly baseUrl = environment.apiUrl;

  // ===== Lectura =====

  getUsers(): Observable<User[]> {
    return this.api
      .get<UsuarioDTO[]>('/biblioteca/usuarios/')
      .pipe(map((dtos) => (dtos ?? []).map((dto) => this.fromUsuarioDTO(dto))))
      .pipe(catchError((err: unknown) => throwError(() => this.toFriendlyError(err))));
  }

  getUserById(id: number): Observable<User> {
    return this.api
      .get<UsuarioDTO>(`/biblioteca/usuarios/${id}/`)
      .pipe(map((dto) => this.fromUsuarioDTO(dto, id)))
      .pipe(catchError((err: unknown) => throwError(() => this.toFriendlyError(err))));
  }

  /**
   * Busca usuarios con el endpoint paginado del backend.
   *
   * `datos` es el array de la página; las métricas de paginación (`maxPages`,
   * `currentpage`, `previous`, `next`) viajan en el propio envelope. ApiService
   * SOLO devuelve `datos` y descarta esas métricas, por lo que este método lee
   * el envelope completo contra HttpClient directamente.
   */
  searchUsers(query?: string, page = 1): Observable<UsuarioSearchResult> {
    let params = new HttpParams().set('page', page);
    if (query && query.trim().length > 0) {
      params = params.set('filter', query.trim());
    }

    return this.http
      .get<PaginarEnvelope<UsuarioDTO[]>>(`${this.baseUrl}/biblioteca/usuarios/paginar/`, { params })
      .pipe(
        map((envelope) => this.fromPaginar(envelope, page)),
        catchError((err: unknown) => throwError(() => this.toFriendlyError(err))),
      );
  }

  // ===== Mutaciones =====

  /** Crea un usuario. `identifier` lo genera el backend (read_only). */
  createUser(data: UsuarioCreateInput): Observable<User> {
    return this.api
      .post<UsuarioDTO>('/biblioteca/usuarios/', this.toUsuarioCreatePayload(data))
      .pipe(map((dto) => this.fromUsuarioDTO(dto)))
      .pipe(catchError((err: unknown) => throwError(() => this.toFriendlyError(err))));
  }

  /**
   * Actualiza un usuario. `password` es opcional; si no se envía el backend
   * conserva el hash existente.
   *
   * Nota: la respuesta de UPDATE del backend NO incluye `id` ni `identifier`
   * (UsuarioSerializerUpdate los omite), así que se reconstruyen a partir del
   * `id` recibido.
   */
  updateUser(id: number, data: UsuarioUpdateInput): Observable<User> {
    return this.api
      .put<UsuarioDTO>(`/biblioteca/usuarios/${id}/`, this.toUsuarioUpdatePayload(data))
      .pipe(map((dto) => this.fromUsuarioDTO(dto, id)))
      .pipe(catchError((err: unknown) => throwError(() => this.toFriendlyError(err))));
  }

  /**
   * Elimina físicamente un usuario.
   *
   * Si el usuario tiene préstamos asociados, el backend responde con
   * `{success:false, Mensaje:"No se puede eliminar: el usuario tiene prestamos
   * asociados"}` (PROTECT). Este método propaga ese mensaje como Error para que
   * la vista avise al usuario en lugar de mostrar un 400 genérico.
   */
  deleteUser(id: number): Observable<boolean> {
    return this.api
      .delete<unknown>(`/biblioteca/usuarios/${id}/`)
      .pipe(map(() => true))
      .pipe(catchError((err: unknown) => throwError(() => this.toFriendlyError(err))));
  }

  /**
   * Reactivación de usuarios.
   *
   * DECISIÓN / LIMITACIÓN: el backend actual NO expone un endpoint para alternar
   * `is_active`. El `PUT` de actualización (UsuarioSerializerUpdate) no lo
   * acepta como editable. Por tanto, la reactivación por API no está soportada
   * hoy. Este método se mantiene para no romper la firma pero devuelve un
   * Observable que falla con un mensaje claro.
   */
  reactivateUser(_id: number): Observable<User> {
    return throwError(
      () =>
        new Error(
          'La reactivación de usuarios requiere soporte del backend (no existe un endpoint para alternar is_active).',
        ),
    );
  }

  // ===== Mapeo DTO <-> modelo =====

  /**
   * Usuario (backend) -> User (frontend).
   *
   * - `id` ← `id` (si el DTO no lo trae, en UPDATE, se usa `fallbackId`).
   * - `name` ← derivado: `first_name + ' ' + last_name` (trim).
   * - `status` ← derivado: `is_active ? 'active' : 'inactive'`.
   * - `password` ← `''`: el backend es write_only (README nunca lo devuelve).
   * - `registrationDate` no existe en el backend: se deja `undefined`.
   */
  private fromUsuarioDTO(dto: UsuarioDTO, fallbackId?: number): User {
    return {
      id: dto.id ?? fallbackId ?? 0,
      name: `${dto.first_name} ${dto.last_name}`.trim(),
      identifier: dto.identifier ?? '',
      role: dto.role === 'admin' ? 'admin' : 'user',
      email: dto.email,
      password: '',
      phone: dto.phone ?? '',
      cedula: dto.cedula ?? undefined,
      address: dto.address ?? undefined,
      registrationDate: undefined,
      status: dto.is_active ? 'active' : 'inactive',
    };
  }

  private toUsuarioCreatePayload(data: UsuarioCreateInput): UsuarioCreatePayload {
    const { first_name, last_name } = this.splitName(data.name);
    return {
      first_name,
      last_name,
      email: data.email,
      password: data.password,
      role: data.role,
      cedula: data.cedula,
      phone: data.phone ?? undefined,
      address: data.address ?? undefined,
    };
  }

  private toUsuarioUpdatePayload(data: UsuarioUpdateInput): UsuarioUpdatePayload {
    const { first_name, last_name } = this.splitName(data.name);
    const payload: UsuarioUpdatePayload = {
      first_name,
      last_name,
      email: data.email,
      role: data.role,
      cedula: data.cedula,
    };
    if (data.phone !== undefined) {
      payload.phone = data.phone;
    }
    if (data.address !== undefined) {
      payload.address = data.address;
    }
    if (data.password) {
      payload.password = data.password;
    }
    return payload;
  }

  /**
   * Divide el nombre compuesto del frontend en `first_name` y `last_name`.
   *
   * "María López" -> first_name "María", last_name "López". Si hay más de dos
   * palabras, la primera va a `first_name` y el resto (unido) a `last_name`
   * ("José María Gil" -> "José" / "María Gil").
   */
  private splitName(name: string): { first_name: string; last_name: string } {
    const parts = name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ');
    return {
      first_name: parts[0] ?? '',
      last_name: parts.slice(1).join(' '),
    };
  }

  private fromPaginar(envelope: PaginarEnvelope<UsuarioDTO[]>, requestedPage: number): UsuarioSearchResult {
    if (!envelope || envelope.success === false) {
      throw new Error(this.messageToText(envelope?.Mensaje));
    }
    return {
      users: (envelope.datos ?? []).map((dto) => this.fromUsuarioDTO(dto)),
      currentPage: envelope.currentpage ?? requestedPage,
      maxPages: envelope.maxPages ?? 1,
      previous: envelope.previous ?? false,
      next: envelope.next ?? false,
    };
  }

  // ===== Normalización de errores =====

  /**
   * El backend responde los errores como envelope con código 4xx
   * (`success:false`). HttpClient lanza un `HttpErrorResponse` ANTES de que
   * ApiService pueda normalizar el envelope (ApiService.unwrap solo corre en la
   * ruta 2xx). Aquí se extrae el `Mensaje` del body para devolver un Error con
   * texto legible (sin "Http failure response ... 400 Bad Request").
   */
  private toFriendlyError(err: unknown): Error {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as PaginarEnvelope<unknown> | string | null | undefined;
      if (body && typeof body === 'object' && body.success === false) {
        return new Error(this.messageToText(body.Mensaje));
      }
      if (typeof body === 'string') {
        return new Error(body);
      }
      if (err.statusText) {
        return new Error(err.statusText);
      }
      return new Error('Ocurrió un error inesperado');
    }
    if (err instanceof Error) {
      return err;
    }
    return new Error('Ocurrió un error inesperado');
  }

  /** Normaliza `Mensaje` (string | string[] | object) a texto. Espejo de ApiService. */
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
      return Object.entries(message as Record<string, unknown>)
        .map(([field, value]) =>
          Array.isArray(value) ? `${field}: ${value.join(', ')}` : `${field}: ${String(value)}`,
        )
        .join('\n');
    }
    return String(message);
  }
}
