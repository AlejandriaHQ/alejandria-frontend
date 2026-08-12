export type LoanStatus = 'active' | 'returned' | 'overdue';

export interface Loan {
  id: number;
  bookId: number;
  userId: number;
  loanDate: Date;
  dueDate: Date;
  returnDate?: Date | null;
  status: LoanStatus;
}
