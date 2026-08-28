export interface Category {
  id: number;
  name: string;
  /** Descripción opcional de la categoría (mapeada a `descripcion` en el backend). */
  description?: string;
  /** Indica si la categoría está activa (mapeada a `activo` en el backend). */
  active?: boolean;
}
