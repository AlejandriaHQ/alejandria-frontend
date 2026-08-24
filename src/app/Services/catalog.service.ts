import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService, PaginatedResult } from './api.service';
import { Category } from '../models/categoria.model';
import { Book } from '../models/libro.model';

/** DTO de categoría tal como lo devuelve el backend Django. */
interface CategoriaDTO {
  id_categoria: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
}

/** Payload para crear/actualizar una categoría (nombre + descripción + activo). */
interface CategoriaPayload {
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

/** DTO de libro tal como lo devuelve el backend Django. */
interface LibroDTO {
  id_libro: number;
  titulo: string;
  autor: string;
  isbn: string;
  anio: number | null;
  editorial?: string | null;
  descripcion?: string | null;
  portada?: string | null;
  cantidad: number;
  id_categoria: number;
  prestados: number;
  disponibles: number;
  activo: boolean;
}

/** Payload para crear/actualizar un libro. */
interface LibroPayload {
  titulo: string;
  autor: string;
  isbn?: string;
  cantidad: number;
  id_categoria: number;
  anio?: number | null;
  editorial?: string | null;
  descripcion?: string | null;
  portada?: string | null;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly api = inject(ApiService);

  /** Caché síncrona de libros. Alimenta `getBooks()/searchBooks()` (consumidores síncronos legados). */
  private booksCache: Book[] = [];

  /** Caché síncrona de categorías. Alimenta `getCategories()` (consumidor síncrono legado). */
  private categoriesCache: Category[] = [];

  // ===== Carga asíncrona desde la API (la usa la vista de catálogo) =====

  loadCategories(): Observable<Category[]> {
    return this.api.get<CategoriaDTO[]>('/biblioteca/categorias/').pipe(
      map((dtos) => {
        this.categoriesCache = (dtos ?? []).map((dto) => this.fromCategoriaDTO(dto));
        return this.categoriesCache;
      }),
    );
  }

  loadBooks(): Observable<Book[]> {
    return this.api.get<LibroDTO[]>('/biblioteca/libros/').pipe(
      map((dtos) => {
        this.booksCache = (dtos ?? []).map((dto) => this.fromLibroDTO(dto));
        return this.booksCache;
      }),
    );
  }

  /**
   * Busca libros con el endpoint paginado y devuelve la página 1 (10 por página).
   *
   * Compatibilidad: mantiene la firma `Observable<Book[]>` que usan las vistas
   * legadas (catálogo, socio). Delega en `searchBooksPage` para no duplicar la
   * lógica de filtros.
   */
  searchBooksAsync(query?: string, categoryId?: number): Observable<Book[]> {
    return this.searchBooksPage(query, categoryId, 1).pipe(map((result) => result.items));
  }

  /**
   * Busca libros con paginación real del backend (`/biblioteca/libros/paginar/`).
   *
   * Conserva los metadatos (`maxPages/currentPage/previous/next`) y mapea los
   * `LibroDTO` a `Book[]`. La caché síncrona se actualiza con los items de la
   * página para que `getBooks()`/`searchBooks()` (consumidores legados) sigan
   * funcionando con los datos visibles.
   */
  searchBooksPage(query?: string, categoryId?: number, page = 1): Observable<PaginatedResult<Book>> {
    const params: Record<string, string | number> = { page };

    if (query && query.trim().length > 0) {
      params['filter'] = query.trim();
    }

    if (categoryId) {
      params['categoria'] = categoryId;
    }

    return this.api.getPaginated<LibroDTO>('/biblioteca/libros/paginar/', params).pipe(
      map((result) => {
        this.booksCache = result.items.map((dto) => this.fromLibroDTO(dto));
        return { ...result, items: this.booksCache };
      }),
    );
  }

  // ===== Getters síncronos (compatibilidad con consumidores legados) =====

  /** Devuelve la caché actual de libros. NO debe usarse para cargar datos nuevos. */
  getBooks(): Book[] {
    return this.booksCache;
  }

  /** Devuelve la caché actual de categorías. NO debe usarse para cargar datos nuevos. */
  getCategories(): Category[] {
    return this.categoriesCache;
  }

  /** Filtro síncrono sobre la caché de libros (lo usa la vista de usuario legada). */
  searchBooks(query?: string, categoryId?: number): Book[] {
    const category = categoryId ?? 0;

    const tokens = this.normalize(query || '')
      .split(/\s+/)
      .filter(Boolean);

    return this.booksCache.filter((book) => {
      const matchesCategory = category === 0 || book.categoryId === category;

      if (!matchesCategory) {
        return false;
      }

      if (tokens.length === 0) {
        return true;
      }

      const bookText = this.normalize(`${book.title} ${book.author} ${book.isbn}`);

      return tokens.every((token) => bookText.includes(token));
    });
  }

  // ===== Mutaciones (asíncronas) =====

  addBook(book: Omit<Book, 'id' | 'available'> & { cantidad?: number }): Observable<Book> {
    return this.api
      .post<LibroDTO>('/biblioteca/libros/', this.toLibroCreatePayload(book))
      .pipe(
        map((dto) => {
          const created = this.fromLibroDTO(dto);
          // Mantiene la caché síncrona al día por si una vista legada la lee
          // sin `subscribe` (p. ej. `getBooks()` tras guardar).
          this.mergeBook(created);
          return created;
        }),
      );
  }

  updateBook(
    id: number,
    data: Partial<Book> & { cantidad?: number; activo?: boolean },
  ): Observable<Book> {
    return this.api
      .put<LibroDTO>(`/biblioteca/libros/${id}/`, this.toLibroUpdatePayload(data))
      .pipe(
        map((dto) => {
          const updated = this.fromLibroDTO(dto);
          this.mergeBook(updated);
          return updated;
        }),
      );
  }

  deleteBook(id: number): Observable<boolean> {
    return this.api.delete<unknown>(`/biblioteca/libros/${id}/`).pipe(
      map(() => {
        this.booksCache = this.booksCache.filter((book) => book.id !== id);
        return true;
      }),
    );
  }

  /**
   * Crea una categoría con nombre obligatorio y descripción opcional.
   *
   * El backend crea la categoría activa por defecto, así que aquí no se envía
   * `activo` (solo se usa al actualizar).
   */
  addCategory(data: { name: string; description?: string }): Observable<Category> {
    return this.api
      .post<CategoriaDTO>('/biblioteca/categorias/', this.toCategoriaCreatePayload(data))
      .pipe(
        map((dto) => {
          const created = this.fromCategoriaDTO(dto);
          this.mergeCategory(created);
          return created;
        }),
      );
  }

  /**
   * Actualiza una categoría de forma parcial: solo envía los campos definidos
   * (nombre, descripción y/o activo).
   */
  updateCategory(
    id: number,
    data: { name?: string; description?: string; active?: boolean },
  ): Observable<Category> {
    return this.api
      .put<CategoriaDTO>(`/biblioteca/categorias/${id}/`, this.toCategoriaUpdatePayload(data))
      .pipe(
        map((dto) => {
          const updated = this.fromCategoriaDTO(dto);
          this.mergeCategory(updated);
          return updated;
        }),
      );
  }

  deleteCategory(id: number): Observable<boolean> {
    return this.api.delete<unknown>(`/biblioteca/categorias/${id}/`).pipe(
      map(() => {
        this.categoriesCache = this.categoriesCache.filter((category) => category.id !== id);
        return true;
      }),
    );
  }

  // ===== Mapeo DTO <-> modelo =====

  private fromLibroDTO(dto: LibroDTO): Book {
    return {
      id: dto.id_libro,
      title: dto.titulo,
      author: dto.autor,
      isbn: dto.isbn,
      categoryId: dto.id_categoria,
      year: dto.anio ?? new Date().getFullYear(),
      available: dto.disponibles > 0,
      description: dto.descripcion ?? undefined,
      cover: dto.portada ?? undefined,
    };
  }

  private toLibroCreatePayload(book: Omit<Book, 'id' | 'available'> & { cantidad?: number }): LibroPayload {
    return {
      titulo: book.title,
      autor: book.author,
      isbn: book.isbn || undefined,
      cantidad: book.cantidad ?? 1,
      id_categoria: book.categoryId,
      anio: book.year ?? undefined,
      descripcion: book.description ?? undefined,
      portada: book.cover ?? undefined,
    };
  }

  private toLibroUpdatePayload(
    data: Partial<Book> & { cantidad?: number; activo?: boolean },
  ): Partial<LibroPayload> {
    const payload: Partial<LibroPayload> = {};

    if (data.title !== undefined) {
      payload.titulo = data.title;
    }
    if (data.author !== undefined) {
      payload.autor = data.author;
    }
    if (data.isbn !== undefined) {
      payload.isbn = data.isbn;
    }
    if (data.categoryId !== undefined) {
      payload.id_categoria = data.categoryId;
    }
    if (data.year !== undefined) {
      payload.anio = data.year;
    }
    if (data.description !== undefined) {
      payload.descripcion = data.description;
    }
    if (data.cover !== undefined) {
      payload.portada = data.cover;
    }
    if (data.cantidad !== undefined) {
      payload.cantidad = data.cantidad;
    }
    if (data.activo !== undefined) {
      payload.activo = data.activo;
    }

    return payload;
  }

  private fromCategoriaDTO(dto: CategoriaDTO): Category {
    return {
      id: dto.id_categoria,
      name: dto.nombre,
      description: dto.descripcion ?? undefined,
      active: dto.activo,
    };
  }

  /** Payload de creación de categoría: nombre obligatorio, descripción opcional. */
  private toCategoriaCreatePayload(data: { name: string; description?: string }): CategoriaPayload {
    const payload: CategoriaPayload = { nombre: data.name };

    if (data.description !== undefined) {
      payload.descripcion = data.description;
    }

    return payload;
  }

  /** Payload de actualización de categoría: solo incluye los campos presentes. */
  private toCategoriaUpdatePayload(data: {
    name?: string;
    description?: string;
    active?: boolean;
  }): Partial<CategoriaPayload> {
    const payload: Partial<CategoriaPayload> = {};

    if (data.name !== undefined) {
      payload.nombre = data.name;
    }
    if (data.description !== undefined) {
      payload.descripcion = data.description;
    }
    if (data.active !== undefined) {
      payload.activo = data.active;
    }

    return payload;
  }

  /** Inserta o actualiza un libro en la caché síncrona por id. */
  private mergeBook(book: Book): void {
    const index = this.booksCache.findIndex((b) => b.id === book.id);
    if (index >= 0) {
      this.booksCache[index] = book;
    } else {
      this.booksCache.push(book);
    }
  }

  /** Inserta o actualiza una categoría en la caché síncrona por id. */
  private mergeCategory(category: Category): void {
    const index = this.categoriesCache.findIndex((c) => c.id === category.id);
    if (index >= 0) {
      this.categoriesCache[index] = category;
    } else {
      this.categoriesCache.push(category);
    }
  }

  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }
}
