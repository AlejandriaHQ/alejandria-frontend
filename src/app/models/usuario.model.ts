export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  /**
   * Nombre visible (compuesto "first_name last_name") para las listas.
   * Se mantiene derivado para no romper las vistas que muestran `user.name`.
   */
  name: string;
  /** Primer nombre (backend `first_name`). Se expone para el formulario de edición. */
  firstName?: string;
  /** Apellido (backend `last_name`). Se expone para el formulario de edición. */
  lastName?: string;
  identifier: string;
  role: UserRole;
  email: string;
  /** Contraseña de acceso. En la futura API se almacenará con hash. */
  password: string;
  phone: string;
  /** Campos de miembro. Se conservan los nombres existentes para no romper pantallas actuales. */
  cedula?: string;
  address?: string;
  registrationDate?: Date | string;
  status?: 'active' | 'inactive';
}
