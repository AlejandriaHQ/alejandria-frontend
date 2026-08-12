export interface Libro {
  id: number;
  titulo: string;
  autor: string;
  isbn: string;
  categoriaId: number;
  anio: number;
  disponible: boolean;
  descripcion?: string;
}
