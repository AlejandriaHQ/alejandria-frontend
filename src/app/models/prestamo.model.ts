export interface Prestamo {
  id: number;
  libroId: number;
  usuarioId: number;
  fechaPrestamo: Date;
  fechaVencimiento: Date;
  fechaDevolucion?: Date | null;
  estado: 'activo' | 'devuelto' | 'vencido';
}
