export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  name: string;
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
