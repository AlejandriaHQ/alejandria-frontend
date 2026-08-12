export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  name: string;
  identifier: string;
  role: UserRole;
  email: string;
  phone: string;
}
