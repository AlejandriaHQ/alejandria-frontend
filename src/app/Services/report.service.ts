import { Injectable, inject } from '@angular/core';
import { CatalogService } from './catalog.service';
import { LoanService } from './loan.service';

export interface ReportRow {
  loanId: number;
  book: string;
  user: string;
  loanDate: Date | string;
  dueDate: Date | string;
  returnDate: Date | string | null | undefined;
  lateReturn: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly catalog = inject(CatalogService);
  private readonly loans = inject(LoanService);

  dashboard() {
    this.loans.detectOverdue();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const loans = this.loans.getLoans();
    return {
      books: this.catalog.getBooks().length,
      users: this.loans.getUsers().length,
      active: loans.filter((l) => l.status === 'active').length,
      overdue: loans.filter((l) => l.status === 'overdue').length,
      month: loans.filter((l) => { const d = new Date(l.loanDate); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).length,
    };
  }

  loansReport(start?: string, end?: string): ReportRow[] {
    return this.rows().filter((row) => this.inRange(row.loanDate, start, end));
  }

  returnsReport(start?: string, end?: string): ReportRow[] {
    return this.rows().filter((row) => row.returnDate && this.inRange(row.returnDate, start, end));
  }

  inventory() {
    return this.catalog.getCategories().map((category) => {
      const books = this.catalog.getBooks().filter((book) => book.categoryId === category.id);
      const total = books.length;
      const available = books.filter((book) => book.available).length;
      return { category: category.name, total, borrowed: total - available, available };
    });
  }

  topBooks() {
    return this.catalog.getBooks().map((book) => ({ label: book.title, total: this.loans.getLoans().filter((l) => l.bookId === book.id).length }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
  }

  topUsers() {
    return this.loans.getUsers().map((user) => ({ label: user.name, total: this.loans.getLoans().filter((l) => l.userId === user.id).length }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
  }

  private rows(): ReportRow[] {
    return this.loans.getLoans().map((loan) => ({
      loanId: loan.id,
      book: this.catalog.getBooks().find((book) => book.id === loan.bookId)?.title ?? 'Libro eliminado',
      user: this.loans.getUserById(loan.userId)?.name ?? 'Usuario eliminado',
      loanDate: loan.loanDate, dueDate: loan.dueDate, returnDate: loan.returnDate,
      lateReturn: !!loan.returnDate && new Date(loan.returnDate) > new Date(loan.dueDate),
    }));
  }

  private inRange(value: Date | string | null | undefined, start?: string, end?: string): boolean {
    if (!value) return false;
    const date = new Date(value); const from = start ? new Date(`${start}T00:00:00`) : null; const to = end ? new Date(`${end}T23:59:59`) : null;
    return (!from || date >= from) && (!to || date <= to);
  }
}
