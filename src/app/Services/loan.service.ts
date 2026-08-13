import { Injectable } from '@angular/core';
import { CatalogService } from './catalog.service';
import { Book } from '../models/libro.model';
import { Loan } from '../models/prestamo.model';
import { LoanRequest } from '../models/solicitud-prestamo.model';
import { User } from '../models/usuario.model';

@Injectable({
  providedIn: 'root',
})
export class LoanService {
  private readonly loansKey = 'alejandria_loans';

  private readonly requestsKey = 'alejandria_requests';

  private readonly usersKey = 'alejandria_users';

  private loans: Loan[] = this.loadLoans();

  private requests: LoanRequest[] = this.loadRequests();

  private users: User[] = this.loadUsers();

  constructor(private catalogService: CatalogService) {
    if (!localStorage.getItem(this.loansKey)) {
      this.saveLoans();
    }

    if (!localStorage.getItem(this.requestsKey)) {
      this.saveRequests();
    }

    if (!localStorage.getItem(this.usersKey)) {
      this.saveUsers();
    }

    this.detectOverdue();
  }

  // Usuarios

  getUsers(): User[] {
    return this.users;
  }

  getUserById(id: number): User | null {
    return this.users.find((user) => user.id === id) ?? null;
  }

  getUserByIdentifier(identifier: string): User | null {
    return this.users.find((user) => user.identifier === identifier) ?? null;
  }

  // Préstamos

  getLoans(): Loan[] {
    return this.loans;
  }

  getActiveLoans(): Loan[] {
    return this.loans.filter((loan) => loan.status === 'active');
  }

  getOverdueLoans(): Loan[] {
    return this.loans.filter((loan) => loan.status === 'overdue');
  }

  getLoansByUser(userId: number): Loan[] {
    return this.loans.filter((loan) => loan.userId === userId);
  }

  // Solicitudes

  getRequests(): LoanRequest[] {
    return this.requests;
  }

  getPendingRequests(): LoanRequest[] {
    return this.requests.filter((request) => request.status === 'pending');
  }

  getRequestsByUser(userId: number): LoanRequest[] {
    return this.requests.filter((request) => request.userId === userId);
  }

  // RF-07 / RN-06: validar si un libro puede eliminarse

  hasActiveLoansForBook(bookId: number): boolean {
    return this.loans.some(
      (loan) => loan.bookId === bookId && (loan.status === 'active' || loan.status === 'overdue'),
    );
  }

  hasPendingRequestsForBook(bookId: number): boolean {
    return this.requests.some(
      (request) => request.bookId === bookId && request.status === 'pending',
    );
  }

  // RF-35: el usuario solicita un préstamo en línea (reserva para mostrador)

  requestLoan(bookId: number, userId: number): LoanRequest | null {
    const book = this.catalogService.getBooks().find((b) => b.id === bookId);

    if (!book || !book.available) {
      return null;
    }

    const nextId = this.nextRequestId();

    const request: LoanRequest = {
      id: nextId,
      bookId,
      userId,
      requestedDate: new Date(),
      status: 'pending',
    };

    this.requests.push(request);

    this.saveRequests();

    return request;
  }

  cancelRequest(requestId: number): boolean {
    const request = this.requests.find((r) => r.id === requestId);

    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'cancelled';

    this.saveRequests();

    return true;
  }

  // ADM: registrar préstamo directo en mostrador (RF-18 + reglas RN)

  createLoan(bookId: number, userId: number): Loan | null {
    const book = this.catalogService.getBooks().find((b) => b.id === bookId);

    if (!book || !book.available) {
      return null;
    }

    // RN-02 / RF-20: máximo 3 ejemplares simultáneos
    if (this.countActiveLoans(userId) >= 3) {
      return null;
    }

    // RN-04 / RF-25: bloqueo si hay vencidos sin devolver
    if (this.hasOverdue(userId)) {
      return null;
    }

    const loanDate = new Date();

    // RN-01: vencimiento = fecha del préstamo + 7 días
    const dueDate = new Date(loanDate);
    dueDate.setDate(dueDate.getDate() + 7);

    const loan: Loan = {
      id: this.nextLoanId(),
      bookId,
      userId,
      loanDate,
      dueDate,
      returnDate: null,
      status: 'active',
    };

    this.loans.push(loan);

    // RF-21: actualizar disponibilidad
    this.catalogService.updateBook(bookId, { available: false });

    this.saveLoans();

    return loan;
  }

  // ADM: aprobar la solicitud y registrar el préstamo (RF-18 + reglas RN)

  approveRequest(requestId: number): Loan | null {
    const request = this.requests.find((r) => r.id === requestId);

    if (!request || request.status !== 'pending') {
      return null;
    }

    const book = this.catalogService.getBooks().find((b) => b.id === request.bookId);

    if (!book) {
      return null;
    }

    // RN-03 / RF-19: no prestar si no hay disponibilidad
    if (!book.available) {
      return null;
    }

    // RN-02 / RF-20: máximo 3 ejemplares simultáneos
    if (this.countActiveLoans(request.userId) >= 3) {
      return null;
    }

    // RN-04 / RF-25: bloqueo si hay vencidos sin devolver
    if (this.hasOverdue(request.userId)) {
      return null;
    }

    const loanDate = new Date();

    // RN-01: vencimiento = fecha del préstamo + 7 días
    const dueDate = new Date(loanDate);
    dueDate.setDate(dueDate.getDate() + 7);

    const loan: Loan = {
      id: this.nextLoanId(),
      bookId: request.bookId,
      userId: request.userId,
      loanDate,
      dueDate,
      returnDate: null,
      status: 'active',
    };

    this.loans.push(loan);

    // RF-21: actualizar disponibilidad
    this.catalogService.updateBook(request.bookId, { available: false });

    request.status = 'approved';

    this.saveRequests();
    this.saveLoans();

    return loan;
  }

  rejectRequest(requestId: number): boolean {
    const request = this.requests.find((r) => r.id === requestId);

    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'rejected';

    this.saveRequests();

    return true;
  }

  // ADM: registrar devolución (RF-22) y actualizar disponibilidad (RF-21)

  returnLoan(loanId: number): boolean {
    const loan = this.loans.find(
      (l) => l.id === loanId && (l.status === 'active' || l.status === 'overdue'),
    );

    if (!loan) {
      return false;
    }

    loan.returnDate = new Date();

    loan.status = 'returned';

    this.catalogService.updateBook(loan.bookId, { available: true });

    this.saveLoans();

    return true;
  }

  // RF-23: detectar préstamos vencidos

  detectOverdue(): void {
    const now = new Date();

    let changed = false;

    for (const loan of this.loans) {
      if (loan.status === 'active' && new Date(loan.dueDate) < now) {
        loan.status = 'overdue';

        changed = true;
      }
    }

    if (changed) {
      this.saveLoans();
    }
  }

  private countActiveLoans(userId: number): number {
    return this.loans.filter(
      (loan) => loan.userId === userId && (loan.status === 'active' || loan.status === 'overdue'),
    ).length;
  }

  private hasOverdue(userId: number): boolean {
    return this.loans.some((loan) => loan.userId === userId && loan.status === 'overdue');
  }

  private nextLoanId(): number {
    return this.loans.reduce((max, loan) => Math.max(max, loan.id), 0) + 1;
  }

  private nextRequestId(): number {
    return this.requests.reduce((max, request) => Math.max(max, request.id), 0) + 1;
  }

  private loadLoans(): Loan[] {
    const stored = localStorage.getItem(this.loansKey);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Dato corrupto: se usa la lista vacía
      }
    }

    return [];
  }

  private loadRequests(): LoanRequest[] {
    const stored = localStorage.getItem(this.requestsKey);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Dato corrupto: se usa la lista vacía
      }
    }

    return [];
  }

  private loadUsers(): User[] {
    const stored = localStorage.getItem(this.usersKey);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Dato corrupto: se usan los valores iniciales
      }
    }

    return [
      {
        id: 1,
        name: 'Usuario Demo',
        identifier: 'usuario001',
        role: 'user',
        email: 'usuario001@alejandria.com',
        phone: '809-000-0001',
      },
      {
        id: 2,
        name: 'María López',
        identifier: 'U-2026-002',
        role: 'user',
        email: 'maria@alejandria.com',
        phone: '809-000-0002',
      },
      {
        id: 3,
        name: 'Carlos Pérez',
        identifier: 'U-2026-003',
        role: 'user',
        email: 'carlos@alejandria.com',
        phone: '809-000-0003',
      },
    ];
  }

  private saveLoans() {
    localStorage.setItem(this.loansKey, JSON.stringify(this.loans));
  }

  private saveRequests() {
    localStorage.setItem(this.requestsKey, JSON.stringify(this.requests));
  }

  private saveUsers() {
    localStorage.setItem(this.usersKey, JSON.stringify(this.users));
  }
}
