export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  categoryId: number;
  year: number;
  available: boolean;
  description?: string;
  cover?: string;
  /** Ejemplares totales, prestados y disponibles (del backend). */
  cantidad?: number;
  prestados?: number;
  disponibles?: number;
}
