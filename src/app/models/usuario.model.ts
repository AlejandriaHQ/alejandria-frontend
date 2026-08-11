export interface Usuario {
  id: number;
  nombre: string;
  identificador: string;
  rol: 'admin' | 'usuario';
  correo: string;
  telefono: string;
}
