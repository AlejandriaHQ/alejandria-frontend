import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { CatalogService } from './catalog.service';
import { UserService } from './user.service';
import { Loan, LoanStatus } from '../models/prestamo.model';
import { LoanRequest, LoanRequestStatus } from '../models/solicitud-prestamo.model';
import { User } from '../models/usuario.model';

/**
 * Estados que emite el backend Django para un préstamo.
 */
type PrestamoEstado = 'Prestado' | 'Devuelto' | 'Atrasado';

/** DTO de préstamo tal como lo devuelve el backend. */
interface PrestamoDTO {
  id_prestamo: number;
  id_usuario: number;
  id_libro: number;
  fecha_prestamo: string;
  fecha_vencimiento: string;
  fecha_devolucion?: string | null;
  fecha_devolucion_real?: string | null;
  devuelto_vencido?: boolean;
  estado: PrestamoEstado;
}

/** Payload para devolver (PUT) un préstamo. */
interface PrestamoReturnPayload {
  estado: 'Devuelto';
  id_usuario: number;
  id_libro: number;
  fecha_prestamo: string;
}

/** Estados que emite el backend para una solicitud de préstamo. */
type SolicitudEstado = 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Cancelada';

/** DTO de solicitud tal como lo devuelve el backend. */
interface SolicitudDTO {
  id_solicitud: number;
  id_usuario: number;
  id_usuario_nombre?: string | null;
  id_libro: number;
  id_libro_titulo?: string | null;
  fecha_solicitud: string;
  estado: SolicitudEstado;
  fecha_respuesta?: string | null;
  observaciones?: string | null;
}

/**
 * Servicio de préstamos y solicitudes de préstamo integrado con la API Django
 * (`/biblioteca/prestamos/` y `/biblioteca/solicitudes/`).
 *
 * Conviven DOS superficies:
 *
 * 1. **Métodos asíncronos (Observable)** que consultan/mutúan el backend. Son los
 *    que consumen las páginas de préstamos (admin y usuario). Incluyen
 *    `createLoanApi`/`requestLoanApi`, que son las versiones de API de crear
 *    préstamo y solicitud (con sufijo `Api` porque `createLoan`/`requestLoan` sin
 *    sufijo quedan reservados como operaciones síncronas legacy).
 *
 * 2. **Métodos síncronos "legacy"** (`getLoans`, `getUsers`, `getUserById`,
 *    `getUserByIdentifier`, `getRequestsByUser`, `hasActiveLoansForBook`,
 *    `hasPendingRequestsForBook`, `createLoan`, `requestLoan`, `detectOverdue`).
 *    Se conservan porque `report.service.ts`, `admin/catalogo` y `usuario/usuario`
 *    los consumen SIN subscribe (no se pueden tocar en esta fase). Se respaldan con
 *    cachés en memoria que las llamadas asíncronas van hidratando.
 *
 * Las reglas de negocio (disponibilidad, máximo de 3 ejemplares, bloqueo por
 * vencidos) las valida el backend. Las mutaciones síncronas legacy son un
 * comportamiento local de respaldo y NO llegan a la API.
 */
@Injectable({
  providedIn: 'root',
})
export class LoanService {
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly catalogService = inject(CatalogService);
  private readonly userService = inject(UserService);

  /** Caché síncrona de préstamos. Alimenta `getLoans()` (consumidores legacy). */
  private loansCache: Loan[] = [];

  /** Caché síncrona de solicitudes. Alimenta `getRequestsByUser()` (consumidores legacy). */
  private requestsCache: LoanRequest[] = [];

  /** Caché síncrona de usuarios. Alimenta `getUsers()/getUserById()` (consumidores legacy). */
  private usersCache: User[] = [];

  constructor() {
    // Solo hidratamos la caché de usuarios para administradores: el backend
    // restringió GET /biblioteca/usuarios/ (y paginar/detalle) a rol admin, así
    // que un usuario normal obtendría 403 y además la llamada es innecesaria en
    // sus vistas. Si no es admin, la caché queda vacía y los getters síncronos
    // legacy (getUsers/getUserById/getUserByIdentifier) degradan de forma segura.
    if (this.authService.getCurrentUser()?.role === 'admin') {
      this.userService.getUsers().subscribe({
        next: (users) => {
          this.usersCache = users;
        },
        error: () => {
          // Sin red / sesión: la caché queda vacía y los métodos síncronos legacy
          // degradan de forma segura.
        },
      });
    }
  }

  // ===== Préstamos: lectura asíncrona (API) =====

  /** Todos los préstamos. Hidrata la caché síncrona. */
  loadLoans(): Observable<Loan[]> {
    return this.api.get<PrestamoDTO[]>('/biblioteca/prestamos/').pipe(
      map((dtos) => {
        const loans = (dtos ?? []).map((dto) => this.fromLoanDTO(dto));
        this.loansCache = loans;
        return loans;
      }),
    );
  }

  /** Préstamos activos (`estado === 'Prestado'`). */
  getActiveLoans(): Observable<Loan[]> {
    return this.loadLoans().pipe(map((loans) => loans.filter((loan) => loan.status === 'active')));
  }

  /** Préstamos devueltos (`estado === 'Devuelto'`). */
  getReturnedLoans(): Observable<Loan[]> {
    return this.loadLoans().pipe(map((loans) => loans.filter((loan) => loan.status === 'returned')));
  }

  /** Préstamos vencidos. Endpoint de solo-admin (`GET /biblioteca/prestamos/vencidos/`). */
  getOverdueLoans(): Observable<Loan[]> {
    return this.api.get<PrestamoDTO[]>('/biblioteca/prestamos/vencidos/').pipe(
      map((dtos) => {
        const loans = (dtos ?? []).map((dto) => this.fromLoanDTO(dto));
        this.mergeLoans(loans);
        return loans;
      }),
    );
  }

  /** Historial de préstamos de un usuario. */
  getLoansByUser(userId: number): Observable<Loan[]> {
    return this.api
      .get<PrestamoDTO[]>('/biblioteca/prestamos/historial/', { usuario: userId })
      .pipe(
        map((dtos) => {
          const loans = (dtos ?? []).map((dto) => this.fromLoanDTO(dto));
          this.mergeLoans(loans);
          return loans;
        }),
      );
  }

  /** Un préstamo por id (se usa para preparar la devolución). */
  getLoanById(id: number): Observable<Loan> {
    return this.api
      .get<PrestamoDTO>(`/biblioteca/prestamos/${id}/`)
      .pipe(map((dto) => this.fromLoanDTO(dto)));
  }

  /**
   * Crea un préstamo en mostrador contra la API (solo-admin).
   *
   * Se expone como `createLoanApi` porque `createLoan` (sin sufijo) queda
   * reservado como operación síncrona legacy para la vista de catálogo.
   */
  createLoanApi(bookId: number, userId: number): Observable<Loan> {
    return this.api
      .post<PrestamoDTO>('/biblioteca/prestamos/', {
        id_usuario: userId,
        id_libro: bookId,
        fecha_prestamo: this.toIsoDate(new Date()),
      })
      .pipe(
        map((dto) => {
          const loan = this.fromLoanDTO(dto);
          this.mergeLoans([loan]);
          return loan;
        }),
      );
  }

  /**
   * Registra la devolución (PUT) de un préstamo.
   *
   * El PUT exige los datos originales del préstamo (`id_usuario`, `id_libro`,
   * `fecha_prestamo`) además del nuevo `estado`, por lo que primero se consulta
   * el préstamo y luego se envía el payload completo.
   */
  returnLoan(loanId: number): Observable<Loan> {
    return this.getLoanById(loanId).pipe(
      switchMap((loan) => {
        const payload: PrestamoReturnPayload = {
          estado: 'Devuelto',
          id_usuario: loan.userId,
          id_libro: loan.bookId,
          fecha_prestamo: this.toIsoDate(loan.loanDate),
        };
        return this.api.put<PrestamoDTO>(`/biblioteca/prestamos/${loanId}/`, payload).pipe(
          map((dto) => {
            const updated = this.fromLoanDTO(dto);
            this.mergeLoans([updated]);
            return updated;
          }),
        );
      }),
    );
  }

  /** Elimina un préstamo (solo-admin). */
  deleteLoan(loanId: number): Observable<boolean> {
    return this.api
      .delete<unknown>(`/biblioteca/prestamos/${loanId}/`)
      .pipe(map(() => true));
  }

  // ===== Préstamos: lectura síncrona (legacy, respaldo en caché) =====

  /** Todos los préstamos (caché). No debe usarse para cargar datos nuevos. */
  getLoans(): Loan[] {
    return [...this.loansCache];
  }

  /**
   * Operación legacy síncrona para crear un préstamo local (la vista de catálogo
   * de admin la invoca sin subscribe). NO llega a la API: registra en la caché.
   * Las validaciones de negocio quedan a cargo del backend cuando se migre esa
   * vista al método asíncrono `createLoanApi`.
   */
  createLoan(bookId: number, userId: number): Loan | null {
    const book = this.catalogService.getBooks().find((b) => b.id === bookId);
    if (!book || !book.available) {
      return null;
    }
    if (this.countActiveLoans(userId) >= 3) {
      return null;
    }
    if (this.hasOverdue(userId)) {
      return null;
    }
    const loanDate = new Date();
    const dueDate = new Date(loanDate);
    dueDate.setDate(dueDate.getDate() + 7);
    const loan: Loan = {
      id: this.nextLoanId(),
      bookId,
      userId,
      loanDate,
      dueDate,
      returnDate: null,
      status: 'active',
    };
    this.loansCache.push(loan);
    return loan;
  }

  /**
   * Operación legacy síncrona para solicitar un préstamo local (la vista de
   * catálogo de usuario la invoca sin subscribe). NO llega a la API.
   */
  requestLoan(bookId: number, userId: number): LoanRequest | null {
    const book = this.catalogService.getBooks().find((b) => b.id === bookId);
    if (!book || !book.available) {
      return null;
    }
    const request: LoanRequest = {
      id: this.nextRequestId(),
      bookId,
      userId,
      requestedDate: new Date(),
      status: 'pending',
    };
    this.requestsCache.push(request);
    return request;
  }

  /** Precarga la caché síncrona de usuarios (para `getUserById`/`getUserByIdentifier`). */
  loadUsers(): Observable<User[]> {
    return this.userService.getUsers().pipe(
      map((users) => {
        this.usersCache = users;
        return users;
      }),
    );
  }

  /** Consulta paginada de usuarios con filtro para modales de préstamos y búsquedas. */
  searchUsersPage(query?: string, page = 1) {
    return this.userService.searchUsers(query, page).pipe(
      map((result) => {
        this.usersCache = result.users;
        return result;
      }),
    );
  }

  getUsers(): User[] {
    return [...this.usersCache];
  }

  getUserById(id: number): User | null {
    return this.usersCache.find((user) => user.id === id) ?? null;
  }

  getUserByIdentifier(identifier: string): User | null {
    return this.usersCache.find((user) => user.identifier === identifier) ?? null;
  }

  // ===== Solicitudes: lectura asíncrona (API) =====

  /** Solicitudes. Para usuario normal devuelve solo las suyas; para admin todas. */
  getRequests(): Observable<LoanRequest[]> {
    return this.api.get<SolicitudDTO[]>('/biblioteca/solicitudes/').pipe(
      map((dtos) => {
        const requests = (dtos ?? []).map((dto) => this.fromSolicitudDTO(dto));
        this.requestsCache = requests;
        return requests;
      }),
    );
  }

  /** Solicitudes pendientes. Filtra `status === 'pending'` sobre la respuesta. */
  getPendingRequests(): Observable<LoanRequest[]> {
    return this.getRequests().pipe(
      map((requests) => requests.filter((request) => request.status === 'pending')),
    );
  }

  // ===== Solicitudes: mutaciones (API) =====

  /**
   * Crea una solicitud en línea contra la API (usuario normal; el backend fuerza
   * su propio `id_usuario`). Devuelve la solicitud creada.
   *
   * Se expone como `requestLoanApi` porque `requestLoan` (sin sufijo) queda
   * reservado como operación síncrona legacy para la vista de catálogo.
   */
  requestLoanApi(bookId: number, userId: number): Observable<LoanRequest> {
    return this.api
      .post<SolicitudDTO>('/biblioteca/solicitudes/', {
        id_usuario: userId,
        id_libro: bookId,
      })
      .pipe(
        map((dto) => {
          const request = this.fromSolicitudDTO(dto);
          this.requestsCache.push(request);
          return request;
        }),
      );
  }

  /** Aprueba una solicitud (solo-admin). El backend registra el préstamo asociado. */
  approveRequest(id: number): Observable<ApproveSolicitudResult> {
    return this.api.post<ApproveSolicitudResult>(`/biblioteca/solicitudes/${id}/aprobar/`, {});
  }

  /** Rechaza una solicitud (solo-admin). */
  rejectRequest(id: number): Observable<SolicitudActionResult> {
    return this.api.post<SolicitudActionResult>(`/biblioteca/solicitudes/${id}/rechazar/`, {});
  }

  /** Cancela una solicitud (dueño de la solicitud o admin). */
  cancelRequest(id: number): Observable<SolicitudActionResult> {
    return this.api.post<SolicitudActionResult>(`/biblioteca/solicitudes/${id}/cancelar/`, {});
  }

  // ===== Solicitudes: lectura síncrona (legacy, respaldo en caché) =====

  /** Solicitudes de un usuario (caché). La vista de catálogo de usuario la usa con `.some()`. */
  getRequestsByUser(userId: number): LoanRequest[] {
    return this.requestsCache.filter((request) => request.userId === userId);
  }

  // ===== Guardas de catálogo (legacy, sobre caché) =====

  /** ¿El libro tiene préstamos activos o vencidos sin devolver? */
  hasActiveLoansForBook(bookId: number): boolean {
    return this.loansCache.some(
      (loan) => loan.bookId === bookId && (loan.status === 'active' || loan.status === 'overdue'),
    );
  }

  /** ¿El libro tiene solicitudes pendientes? */
  hasPendingRequestsForBook(bookId: number): boolean {
    return this.requestsCache.some(
      (request) => request.bookId === bookId && request.status === 'pending',
    );
  }

  /**
   * No-op. El backend normaliza el estado `Atrasado` al calcularlo al vuelo; no
   * hay que detectar vencimientos en el cliente.
   */
  detectOverdue(): void {
    // Intencionalmente vacío: la API expone `/biblioteca/prestamos/vencidos/`.
  }

  // ===== Mapeo DTO <-> modelo =====

  private fromLoanDTO(dto: PrestamoDTO): Loan {
    return {
      id: dto.id_prestamo,
      bookId: dto.id_libro,
      userId: dto.id_usuario,
      loanDate: this.parseDate(dto.fecha_prestamo) ?? new Date(),
      dueDate: this.parseDate(dto.fecha_vencimiento) ?? new Date(),
      returnDate:
        this.parseDate(dto.fecha_devolucion_real) ?? this.parseDate(dto.fecha_devolucion) ?? null,
      status: this.loanStatusFromBackend(dto.estado),
    };
  }

  private fromSolicitudDTO(dto: SolicitudDTO): LoanRequest {
    return {
      id: dto.id_solicitud,
      bookId: dto.id_libro,
      userId: dto.id_usuario,
      requestedDate: this.parseDate(dto.fecha_solicitud) ?? new Date(),
      status: this.requestStatusFromBackend(dto.estado),
      // El backend ya envía el nombre del usuario y el título del libro:
      // se usan como fuente primaria para no depender de la caché local.
      bookTitle: dto.id_libro_titulo ?? undefined,
      userName: dto.id_usuario_nombre ?? undefined,
    };
  }

  private loanStatusFromBackend(estado: PrestamoEstado): LoanStatus {
    switch (estado) {
      case 'Prestado':
        return 'active';
      case 'Devuelto':
        return 'returned';
      case 'Atrasado':
        return 'overdue';
    }
  }

  private requestStatusFromBackend(estado: SolicitudEstado): LoanRequestStatus {
    switch (estado) {
      case 'Pendiente':
        return 'pending';
      case 'Aprobada':
        return 'approved';
      case 'Rechazada':
        return 'rejected';
      case 'Cancelada':
        return 'cancelled';
    }
  }

  /**
   * Parsea una fecha 'YYYY-MM-DD' del backend a un `Date` local. No se usa
   * `new Date('YYYY-MM-DD')` porque este se interpreta como medianoche UTC y
   * desplazaría el día en zonas horarias negativas (ver reportes.page.ts).
   */
  private parseDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /** Convierte una fecha local a 'YYYY-MM-DD' (formato que espera el backend). */
  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Fusiona préstamos en la caché síncrona (por id) para no perder registros. */
  private mergeLoans(loans: Loan[]): void {
    for (const loan of loans) {
      const index = this.loansCache.findIndex((l) => l.id === loan.id);
      if (index >= 0) {
        this.loansCache[index] = loan;
      } else {
        this.loansCache.push(loan);
      }
    }
  }

  // ===== Helpers de negocio para las operaciones legacy síncronas =====

  private countActiveLoans(userId: number): number {
    return this.loansCache.filter(
      (loan) => loan.userId === userId && (loan.status === 'active' || loan.status === 'overdue'),
    ).length;
  }

  private hasOverdue(userId: number): boolean {
    return this.loansCache.some((loan) => loan.userId === userId && loan.status === 'overdue');
  }

  private nextLoanId(): number {
    return this.loansCache.reduce((max, loan) => Math.max(max, loan.id), 0) + 1;
  }

  private nextRequestId(): number {
    return this.requestsCache.reduce((max, request) => Math.max(max, request.id), 0) + 1;
  }
}

/** Resultado de `POST .../aprobar/`: el backend devuelve solicitud + préstamo. */
export interface ApproveSolicitudResult {
  solicitud?: unknown;
  prestamo?: unknown;
}

/** Resultado genérico de las acciones sobre solicitudes (rechazar/cancelar). */
export interface SolicitudActionResult {
  [key: string]: unknown;
}
