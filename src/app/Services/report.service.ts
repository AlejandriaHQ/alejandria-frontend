import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { CatalogService } from './catalog.service';
import { LoanService } from './loan.service';

export interface ReportRow {
  loanId: number;
  book: string;
  user: string;
  loanDate: Date | string | null | undefined;
  dueDate: Date | string | null | undefined;
  returnDate: Date | string | null | undefined;
  lateReturn: boolean;
}

export interface InventoryRow {
  category: string;
  total: number;
  borrowed: number;
  available: number;
}

export interface RankingRow {
  label: string;
  total: number;
}

/** DTO del dashboard del backend (`datos`). */
interface DashboardDTO {
  total_libros: number;
  total_usuarios: number;
  prestamos_activos: number;
  vencidos: number;
  prestamos_del_mes: number;
}

/** DTO de un préstamo dentro del reporte por rango (`datos.prestamos[]`). */
interface LoanReportItemDTO {
  id_prestamo: number;
  id_usuario: number;
  id_libro: number;
  fecha_prestamo: string;
  estado: string;
}

/** payload de `/biblioteca/reportes/prestamos/`. */
interface LoansReportDTO {
  total: number;
  rango: { desde: string; hasta: string };
  prestamos: LoanReportItemDTO[];
}

/** DTO de una devolución dentro del reporte por rango (`datos.devoluciones[]`). */
interface ReturnsReportItemDTO {
  id_prestamo: number;
  id_usuario: number;
  id_libro: number;
  fecha_devolucion_real: string;
  estado: string;
}

/** payload de `/biblioteca/reportes/devoluciones/`. */
interface ReturnsReportDTO {
  total: number;
  rango: { desde: string; hasta: string };
  devoluciones: ReturnsReportItemDTO[];
}

/** DTO de una fila de inventario (`datos[]`). */
interface InventoryDTO {
  categoria: string | null;
  libro: string;
  cantidad: number;
  prestados: number;
  disponibles: number;
}

/** DTO de un libro en el ranking (`datos[]`). */
interface TopLibroDTO {
  id_libro: number;
  titulo: string | null;
  total_prestamos: number;
}

/** DTO de un usuario en el ranking (`datos[]`). */
interface TopUsuarioDTO {
  id_usuario: number;
  nombre: string;
  email: string;
  total_prestamos: number;
}

/**
 * Servicio de reportes integrado con la API del backend Django.
 *
 * Los endpoints (base `/biblioteca/reportes/`) son de SOLO LECTURA y SOLO ADMIN:
 * si el usuario no es admin, el backend responde `{success:false, Mensaje:"No
 * tiene permisos para ver reportes"}` con 403, que `ApiService` normaliza a un
 * `Error.message` legible (se propaga a la página para que lo muestre).
 *
 * Cada método devuelve un `Observable` y mapea el objeto `datos` del envelope a
 * la forma que consume la página de reportes.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = inject(ApiService);
  private readonly catalog = inject(CatalogService);
  private readonly loans = inject(LoanService);

  private readonly basePath = '/biblioteca/reportes/';

  /** Indicadores generales del panel (RF-26). */
  dashboard(): Observable<{ books: number; users: number; active: number; overdue: number; month: number }> {
    return this.api.get<DashboardDTO>(`${this.basePath}dashboard/`).pipe(
      map((dto) => ({
        books: dto.total_libros ?? 0,
        users: dto.total_usuarios ?? 0,
        active: dto.prestamos_activos ?? 0,
        overdue: dto.vencidos ?? 0,
        month: dto.prestamos_del_mes ?? 0,
      })),
    );
  }

  /** Reporte de préstamos por rango de fechas (RF-27). */
  loansReport(start?: string, end?: string): Observable<ReportRow[]> {
    return this.api.get<LoansReportDTO>(`${this.basePath}prestamos/`, { desde: start ?? '', hasta: end ?? '' }).pipe(
      map((dto) => (dto.prestamos ?? []).map((item) => this.fromLoanItem(item))),
    );
  }

  /** Reporte de devoluciones reales por rango de fechas (RF-28). */
  returnsReport(start?: string, end?: string): Observable<ReportRow[]> {
    return this.api.get<ReturnsReportDTO>(`${this.basePath}devoluciones/`, { desde: start ?? '', hasta: end ?? '' }).pipe(
      map((dto) => (dto.devoluciones ?? []).map((item) => this.fromReturnsItem(item))),
    );
  }

  /** Inventario (cantidad, prestados, disponibles) por fila de libro (RF-29). */
  inventory(): Observable<InventoryRow[]> {
    return this.api.get<InventoryDTO[]>(`${this.basePath}inventario/`).pipe(
      map((dtos) =>
        (dtos ?? []).map((dto) => ({
          category: dto.categoria ?? 'Sin categoría',
          total: dto.cantidad ?? 0,
          borrowed: dto.prestados ?? 0,
          available: dto.disponibles ?? 0,
        })),
      ),
    );
  }

  /** Top 10 de libros más prestados (RF-30). */
  topBooks(): Observable<RankingRow[]> {
    return this.api.get<TopLibroDTO[]>(`${this.basePath}top-libros/`).pipe(
      map((dtos) =>
        (dtos ?? []).map((dto) => ({
          label: dto.titulo ?? `Libro #${dto.id_libro}`,
          total: dto.total_prestamos ?? 0,
        })),
      ),
    );
  }

  /** Top 10 de usuarios con más préstamos (RF-31). */
  topUsers(): Observable<RankingRow[]> {
    return this.api.get<TopUsuarioDTO[]>(`${this.basePath}top-usuarios/`).pipe(
      map((dtos) =>
        (dtos ?? []).map((dto) => ({
          label: dto.nombre || dto.email || `Usuario #${dto.id_usuario}`,
          total: dto.total_prestamos ?? 0,
        })),
      ),
    );
  }

  /**
   * Convierte un item de préstamo en `ReportRow`.
   *
   * DECISIÓN (book/user): el endpoint de rango NO enriquece con título ni
   * nombre, solo expone `id_libro`/`id_usuario`. Se resuelven los nombres desde
   * las cachés síncronas (`catalogService.getBooks()`, `loanService.getUsers()`).
   * Si la caché no está hidratada se degrada de forma segura mostrando el id
   * legible (`Libro #N` / `Usuario #N`) en lugar de romper.
   *
   * DECISIÓN (dueDate/lateReturn): el endpoint de rango tampoco trae
   * `fecha_vencimiento`. Se intenta resolver el vencimiento desde `getLoans()`
   * (que sí lo trae) cuando la caché de préstamos está disponible; si no, se
   * deja `null`. `lateReturn` se fija en `false` por contrato (la señal
   * `estado === 'Atrasado'` no garantiza la extemporaneidad real de la
   * devolución y el template no debe confundirse).
   */
  private fromLoanItem(item: LoanReportItemDTO): ReportRow {
    const cachedLoan = this.loans.getLoans().find((loan) => loan.id === item.id_prestamo);
    return {
      loanId: item.id_prestamo,
      book: this.resolveBookTitle(item.id_libro),
      user: this.resolveUserName(item.id_usuario),
      loanDate: this.parseDate(item.fecha_prestamo) ?? item.fecha_prestamo,
      dueDate: cachedLoan?.dueDate ?? null,
      returnDate: null,
      lateReturn: false,
    };
  }

  /** Convierte un item de devolución en `ReportRow`. */
  private fromReturnsItem(item: ReturnsReportItemDTO): ReportRow {
    return {
      loanId: item.id_prestamo,
      book: this.resolveBookTitle(item.id_libro),
      user: this.resolveUserName(item.id_usuario),
      loanDate: null,
      dueDate: null,
      returnDate: this.parseDate(item.fecha_devolucion_real) ?? item.fecha_devolucion_real,
      lateReturn: false,
    };
  }

  /** Resuelve el título del libro desde la caché síncrona; fallback al id. */
  private resolveBookTitle(bookId: number): string {
    const book = this.catalog.getBooks().find((b) => b.id === bookId);
    return book?.title ?? `Libro #${bookId}`;
  }

  /** Resuelve el nombre del usuario desde la caché síncrona; fallback al id. */
  private resolveUserName(userId: number): string {
    const user = this.loans.getUserById(userId);
    return user?.name ?? `Usuario #${userId}`;
  }

  /**
   * Parsea una fecha 'YYYY-MM-DD' del backend a un `Date` local. No se usa
   * `new Date('YYYY-MM-DD')` porque se interpreta como medianoche UTC y
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
}
