export type LoanRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LoanRequest {
  id: number;
  bookId: number;
  userId: number;
  requestedDate: Date;
  status: LoanRequestStatus;
  /** Nombres resueltos por el backend (evitan depender de la caché). */
  bookTitle?: string;
  userName?: string;
}
